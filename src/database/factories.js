const pool = require("./pool");
const { ANSIcolors, keysToSnake, keysToCamel, DatabaseError } = require("../util");
const { ulid } = require("ulid");

const tableFactory = ({
    tableName,
    columns = [],
    indexes = [],
    triggers = []
}) => async () => {
    try {
        // Check if table already exists
        const checkQuery = `
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            );
        `;
        const existsResult = await pool.query(checkQuery, [tableName]);
        const alreadyExists = existsResult.rows[0].exists;

        // Build column definitions
        const columnDefs = columns.map(col => {
            let def = `${col.name} ${col.type}`;
            if (col.primaryKey) def += " PRIMARY KEY";
            if (col.default) def += ` DEFAULT ${col.default}`;
            if (col.notNull) def += " NOT NULL";
            if (col.unique) def += " UNIQUE";
            if (col.references) def += ` REFERENCES ${col.references}`;
            if (col.cascade) def += " ON DELETE CASCADE"
            if (col.check) def += ` CHECK (${col.check})`;
            return def;
        }).join(', ');
        // Create table
        const query = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs});`
        await pool.query(query);
        // Create indexes if provided
        for (const index of indexes) {
            const iQuery = `CREATE INDEX IF NOT EXISTS ${index.name} ON ${tableName}(${index.columns.join(", ")});`
            await pool.query(iQuery);
        };
        // Create triggers if provided
        for (const trigger of triggers) {
            const tQuery = `
                DROP TRIGGER IF EXISTS ${trigger.name} ON ${tableName};
                CREATE TRIGGER ${trigger.name}
                ${trigger.timing} ${trigger.event} ON ${tableName}
                FOR EACH ROW
                EXECUTE FUNCTION ${trigger.function};
            `;
            await pool.query(tQuery);
        };
        return {
            message: alreadyExists
                ? `Table '${tableName}' already exists`
                : `Table '${tableName}' created successfully`,
        }
    } catch (error) {
        throw new DatabaseError("Failed to create table in database", {
            table: tableName,
            operation: "CREATE",
            code: error.code
        });
    };
};

const createFactory = ({
    tableName,
    columns,
    returning = ["*"]
}) => async (data) => {
    try {
        // Auto-generate ULID for id field
        data.id = ulid();

        // Convert data to snake_case for the database to understand
        const snakeData = keysToSnake(data);
        // Validate data - include 'id' in validation
        const entries = Object.entries(snakeData).filter(([key]) => columns.includes(key) || key === 'id');
        if (entries.length === 0) throw new Error(`No valid columns provided for ${tableName}`);
        // Build the query
        const cols = entries.map(([key]) => key).join(", ");
        const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ");
        const values = entries.map(([_, value]) => value);
        const returningCols = returning.join(", ");
        const query = `
                INSERT INTO ${tableName} (${cols})
                VALUES (${placeholders})
                RETURNING ${returningCols};
            `
        // Use query
        const result = await pool.query(query, values);
        // Return in camelCase
        return keysToCamel(result.rows[0]);
    } catch (error) {
        throw new DatabaseError("Failed to add record to database", {
            table: tableName,
            operation: "CREATE",
            code: error.code
        })
    };
};

const getFactory = ({
    tableName,
    allowedFields = ["*"],
    allowedConditions = []
}) => async (conditions = {}, returnFields = allowedFields) => {
    try {
        // Convert conditions to snake_case
        const snakeConditions = keysToSnake(conditions);
        // Validate return fields
        const validReturnFields = returnFields.filter(field => allowedFields.includes(field) || allowedFields.includes("*"));
        if (validReturnFields.length === 0 && !allowedFields.includes("*")) throw new Error(`No valid return fields for ${tableName}`);
        // Validate conditions
        const conditionEntries = Object.entries(snakeConditions).filter(([key]) => allowedConditions.includes(key));
        if (conditionEntries.length === 0) throw new Error(`No valid conditions provided for ${tableName}`);
        // Build query
        const selectCols = allowedFields.includes("*") ? "*" : validReturnFields.join(", ");
        const whereClause = conditionEntries.map(([key], i) => `${key} = $${i + 1}`);
        const values = conditionEntries.map(([_, value]) => value);
        const query = `
                SELECT ${selectCols}
                FROM ${tableName}
                WHERE ${whereClause.join(" AND ")};
            `;
        // Use query
        const result = await pool.query(query, values);
        // Return in camelCase
        return result.rows[0] ? keysToCamel(result.rows[0]) : undefined;
    } catch (error) {
        throw new DatabaseError("Failed to get data from database", {
            table: tableName,
            operation: "SELECT",
            code: error.code
        });
    };
};

const updateFactory = ({
    tableName,
    allowedFields = [],
    allowedConditions = [],
    returning = ["id", "updated_at"]
}) => async (conditions = {}, updateData = {}) => {
    try {
        // Convert to snake_case
        const snakeConditions = keysToSnake(conditions);
        const snakeUpdateData = keysToSnake(updateData);
        // Validate update fields
        const updateEntries = Object.entries(snakeUpdateData).filter(([key]) => allowedFields.includes(key));
        if (updateEntries.length === 0) throw new Error(`No valid fields provided to update in ${tableName}`);
        // Validate conditions
        const conditionEntries = Object.entries(snakeConditions).filter(([key]) => allowedConditions.includes(key));
        if (conditionEntries.length === 0) throw new Error(`No valid conditions provided for ${tableName}`);
        // Build clauses
        const values = [];
        let paramCount = 1;
        // SET
        const setClause = updateEntries.map(([key, value]) => {
            values.push(value);
            return `${key} = $${paramCount++}`;
        }).join(", ");
        // WHERE
        const whereClause = conditionEntries.map(([key, value]) => {
            values.push(value);
            return `${key} = $${paramCount++}`;
        }).join(" AND ");
        // RETURNING
        const returningCols = returning.join(", ");
        // Build query
        const query = `
                UPDATE ${tableName}
                SET ${setClause}
                WHERE ${whereClause}
                RETURNING ${returningCols};
            `;
        // Use query
        const result = await pool.query(query, values);
        // Return in camelCase
        return result.rows[0] ? keysToCamel(result.rows[0]) : undefined;
    } catch (error) {
        throw new DatabaseError("Failed to update data in database", {
            table: tableName,
            operation: "UPDATE",
            code: error.code
        });
    };
};

const deleteFactory = ({
    tableName,
    allowedConditions = []
}) => async (conditions = {}) => {
    try {
        // Convert to snake_case
        const snakeConditions = keysToSnake(conditions);
        // Validate conditions
        const conditionEntries = Object.entries(snakeConditions).filter(([key]) => allowedConditions.includes(key));
        if (conditionEntries.length === 0) throw new Error(`No valid conditions provided for ${tableName}`);
        // Build query
        const whereClause = conditionEntries.map(([key], i) => `${key} = $${i + 1}`).join(" AND ");
        const values = conditionEntries.map(([_, value]) => value);
        const query = `
                DELETE FROM ${tableName}
                WHERE ${whereClause};
            `;
        // Use query
        const result = await pool.query(query, values);
        // Return row count
        return result.rowCount;
    } catch (error) {
        throw new DatabaseError("Failed to single-delete from database", {
            table: tableName,
            operation: "DELETE",
            code: error.code
        });
    };
};

const deleteBulkFactory = ({
    tableName,
    allowedConditions = []
}) => async (rawConditions = {}) => {
    try {
        // Convert to snake_case
        const snakeConditions = keysToSnake(rawConditions)
        // Validate conditions
        const conditionEntries = Object.entries(snakeConditions).filter(([key]) => {
            // Extract the base field name (before comparison operator)
            const baseKey = key.split("$")[0];
            return allowedConditions.includes(baseKey)
        });
        if (conditionEntries.length === 0) throw new Error(`No valid conditions provided for ${tableName}`);
        // Build where clause
        const whereClauses = []
        const values = []
        let paramCount = 1;

        for (const [key, value] of conditionEntries) {
            const parts = key.split("$");
            const field = parts[0];
            const operator = parts[1] || "eq"; // Default to equals

            switch (operator) {
                case "lt": // less than
                    whereClauses.push(`${field} < $${paramCount++}`);
                    values.push(value);
                    break;
                case "gt": // greater than
                    whereClauses.push(`${field} > $${paramCount++}`);
                    values.push(value);
                    break;
                case "lte": // less than / equal to
                    whereClauses.push(`${field} <= $${paramCount++}`);
                    values.push(value);
                    break;
                case "gte": // greater than / equal to
                    whereClauses.push(`${field} >= $${paramCount++}`);
                    values.push(value);
                    break;
                case "is_null":
                    whereClauses.push(`${field} IS NULL`);
                    break;
                case "not_null":
                    whereClauses.push(`${field} IS NOT NULL`);
                    break;
                default: // equals
                    whereClauses.push(`${field} = $${paramCount++}`);
                    values.push(value);
            };
        };

        const query = `DELETE FROM ${tableName} WHERE ${whereClauses.join(" AND ")} RETURNING id;`;

        const result = await pool.query(query, values);
        return result.rowCount;
    } catch (error) {
        throw new DatabaseError("Failed bulk-delete from database", {
            table: tableName,
            operation: "DELETE",
            code: error.code
        });
    };
};

module.exports = {
    tableFactory,
    createFactory,
    getFactory,
    updateFactory,
    deleteFactory,
    deleteBulkFactory
};