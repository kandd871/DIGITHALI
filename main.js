// Save your sheet ID and name of the tab as variables for use
let sheetID = "1bT4kLhfWLxU1ZYFVyhAbR1BKvAZFVx0I21GtZf80juw";
let tabName = 'Sheet1';

// Format them into Ben's URI
let opensheet_uri = `https://opensheet.elk.sh/${sheetID}/${tabName}`;

document.addEventListener('DOMContentLoaded', function () {
    fetch(opensheet_uri)
        .then(function (response) {
            return response.json();
        })
        .then(function (data) {
            console.log(data);
            displayContainers(data);
        })
        .catch(function (err) {
            console.log("Something went wrong!", err);
        });
});

function displayContainers(data) {
    const container = document.querySelector('.container');

    // Clear the container first (if needed)
    container.innerHTML = '';

    data.forEach(obj => {
        let element;
        if (obj.img.includes("i.ytimg.com")) {
            const videoID = obj.img.split("/vi/")[1].split("/")[0];
            element = document.createElement('iframe');
            element.src = `https://www.youtube.com/embed/${videoID}?autoplay=1&mute=1`;
            element.style.border = "none";
            element.style.aspectRatio = "16 / 9";
            element.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
            element.allowFullscreen = true;

        } else if (obj.img.includes("tiktok.com")) {
            const videoId = obj.img.split("/video/")[1];
            const blockquote = document.createElement('blockquote');
            blockquote.className = "tiktok-embed";
            blockquote.setAttribute("cite", obj.img);
            blockquote.setAttribute("data-video-id", videoId);
            blockquote.style.width = "auto";
            blockquote.style.height = "10vw";

            blockquote.innerHTML = `
                <section>
                    <a target="_blank" title="@user" href="${obj.img.split('/video')[0]}">@user</a>
                </section>`;
            element = blockquote;

        } else if (obj.img.includes("instagram.com")) {
            // Extract Instagram post ID from iframe code
            const postID = extractInstagramPostID(obj.img);
            element = document.createElement('iframe');
            element.src = `https://www.instagram.com/p/${postID}/embed/`;
            element.scrolling = "no";
            element.allowTransparency = "true";
            element.allowFullscreen = "true";
            element.style.width = "auto"; // Set to 100% for responsive design
            element.style.height = "10vw"; // Set a fixed height or adjust as necessary

        } else if (obj.img.includes("redd.it")) {
            element = document.createElement('video');
            element.src = obj.img; // Use the direct video URL
            element.controls = true; // Enable video controls
            element.style.width = "auto"; // Set to 100% for responsive design
            element.style.height = "15vw"; // Maintain aspect ratio
            element.autoplay = true; // Automatically play the video
            element.loop = true; // Optional: loop the video
            element.muted = true; // Mute the video

        } else {
            element = document.createElement('img');
            element.src = obj.img;
            element.alt = obj.Title;
        }

        container.appendChild(element);
    });

    // Append Instagram and TikTok embed scripts
    const tiktokScript = document.createElement('script');
    tiktokScript.src = "https://www.tiktok.com/embed.js";
    tiktokScript.async = true;
    document.body.appendChild(tiktokScript);
}

// Function to extract the Instagram post ID
function extractInstagramPostID(iframeCode) {
    const regex = /https:\/\/www\.instagram\.com\/p\/([^\/]+)\/embed\//;
    const match = iframeCode.match(regex);
    return match ? match[1] : null; // Return the ID or null if not found
}
