// save your sheet ID and name of the tab as variables for use
let sheetID = "1bT4kLhfWLxU1ZYFVyhAbR1BKvAZFVx0I21GtZf80juw";
let tabName = 'Sheet1'

// format them into Ben's uri
let opensheet_uri = `https://opensheet.elk.sh/${sheetID}/${tabName}`;

document.addEventListener('DOMContentLoaded', function() {
    fetch(opensheet_uri)
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            console.log(data);
            displayContainers(data);
        })
        .catch(function(err) {
            console.log("Something went wrong!", err);
        });
});

function displayContainers(data) {
    const container = document.querySelector('.container');
    data.forEach(obj => {
        // Check 