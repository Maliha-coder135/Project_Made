document.addEventListener("DOMContentLoaded", function() {

let passwordInput = document.getElementById("password");

passwordInput.addEventListener("keyup", function() {

let value = passwordInput.value;

validateRule("length", value.length >= 8);
validateRule("uppercase", /[A-Z]/.test(value));
validateRule("number", /[0-9]/.test(value));
validateRule("special", /[!@#$%^&*]/.test(value));

});

document.getElementById("registerForm").addEventListener("submit", function(e) {

let name = document.getElementById("name").value;
let password = document.getElementById("password").value;
let confirm = document.getElementById("confirm").value;

if(password !== confirm) {
alert("Passwords do not match!");
return;
}

alert("You are successfully registered in WaterTrack-PK, " + name + "!");
});

});

function validateRule(id, condition) {
let element = document.getElementById(id);
if(condition) {
element.classList.remove("text-danger");
element.classList.add("valid");
} else {
element.classList.add("text-danger");
element.classList.remove("valid");
}
}

function togglePassword() {
let passwordField = document.getElementById("password");
passwordField.type = passwordField.type === "password" ? "text" : "password";
}
window.addEventListener("load", function() {

setTimeout(function() {
document.getElementById("loader").style.display = "none";
document.getElementById("formContainer").classList.remove("d-none");
}, 2000);

});

function togglePassword() {
let pass = document.getElementById("password");
pass.type = pass.type === "password" ? "text" : "password";
}