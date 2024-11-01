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
        // Check if the URL is a video thumbnail or a regular image
        if (obj.img.includes("i.ytimg.com")) {
            // Extract the video ID from the thumbnail URL
            const videoID = obj.img.split("/vi/")[1].split("/")[0];
            
            // Create an iframe element for the YouTube video
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube.com/embed/${videoID}?autoplay=1&mute=1`;
            iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
            
            // Append the iframe to the container
            container.appendChild(iframe);
        } else {
            // If it's a regular image URL, display it as an image
            const img = document.createElement('img');
            img.src = obj.img;
            img.alt = obj.Title;  // Set an alt text for accessibility
            container.appendChild(img);
        }
    });
}
