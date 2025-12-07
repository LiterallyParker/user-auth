const buildUI = () => {
	const body = document.getElementById("body-div");
	const p = document.createElement("p")
	p.innerHTML = "This is the p";
	body.appendChild(p);
};

window.addEventListener("DOMContentLoaded", () => {
	buildUI()
});