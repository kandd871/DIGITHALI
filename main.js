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
            element = document.createElement('div');
            element.innerHTML = obj.img;
            element.className = "tiktok-video"; // Apply CSS class for styling
            
        } else if (obj.img.includes("instagram.com")) {
            element = document.createElement('div');
            element.innerHTML = obj.img;
            element.className = "instagram-video"; // Apply CSS class for styling
        } else if (obj.img.includes("redd.it")) {
            element = document.createElement('video');
            element.src = obj.img; // Use the direct video URL
            element.controls = true;
            element.autoplay = true;
            element.loop = true;
            element.muted = true;
            element.className = "reddit-video"; // Apply CSS class for styling
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

let canvas = document.getElementById("canvas")
let ctx = canvas.getContext('2d')

let cameraOffset = { x: window.innerWidth/2, y: window.innerHeight/2 }
let cameraZoom = 1
let MAX_ZOOM = 5
let MIN_ZOOM = 0.1
let SCROLL_SENSITIVITY = 0.0005

function draw()
{
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    
    // Translate to the canvas centre before zooming - so you'll always zoom on what you're looking directly at
    ctx.translate( window.innerWidth / 2, window.innerHeight / 2 )
    ctx.scale(cameraZoom, cameraZoom)
    ctx.translate( -window.innerWidth / 2 + cameraOffset.x, -window.innerHeight / 2 + cameraOffset.y )
    ctx.clearRect(0,0, window.innerWidth, window.innerHeight)
    
    requestAnimationFrame( draw )
}

// Gets the relevant location from a mouse or single touch event
function getEventLocation(e)
{
    if (e.touches && e.touches.length == 1)
    {
        return { x:e.touches[0].clientX, y: e.touches[0].clientY }
    }
    else if (e.clientX && e.clientY)
    {
        return { x: e.clientX, y: e.clientY }        
    }
}

function drawRect(x, y, width, height)
{
    ctx.fillRect( x, y, width, height )
}

function drawText(text, x, y, size, font)
{
    ctx.font = `${size}px ${font}`
    ctx.fillText(text, x, y)
}

let isDragging = false
let dragStart = { x: 0, y: 0 }

function onPointerDown(e)
{
    isDragging = true
    dragStart.x = getEventLocation(e).x/cameraZoom - cameraOffset.x
    dragStart.y = getEventLocation(e).y/cameraZoom - cameraOffset.y
}

function onPointerUp(e)
{
    isDragging = false
    initialPinchDistance = null
    lastZoom = cameraZoom
}

function onPointerMove(e)
{
    if (isDragging)
    {
        cameraOffset.x = getEventLocation(e).x/cameraZoom - dragStart.x
        cameraOffset.y = getEventLocation(e).y/cameraZoom - dragStart.y
    }
}

function handleTouch(e, singleTouchHandler)
{
    if ( e.touches.length == 1 )
    {
        singleTouchHandler(e)
    }
    else if (e.type == "touchmove" && e.touches.length == 2)
    {
        isDragging = false
        handlePinch(e)
    }
}

let initialPinchDistance = null
let lastZoom = cameraZoom

function handlePinch(e)
{
    e.preventDefault()
    
    let touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    let touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY }
    
    // This is distance squared, but no need for an expensive sqrt as it's only used in ratio
    let currentDistance = (touch1.x - touch2.x)**2 + (touch1.y - touch2.y)**2
    
    if (initialPinchDistance == null)
    {
        initialPinchDistance = currentDistance
    }
    else
    {
        adjustZoom( null, currentDistance/initialPinchDistance )
    }
}

function adjustZoom(zoomAmount, zoomFactor)
{
    if (!isDragging)
    {
        if (zoomAmount)
        {
            cameraZoom += zoomAmount
        }
        else if (zoomFactor)
        {
            console.log(zoomFactor)
            cameraZoom = zoomFactor*lastZoom
        }
        
        cameraZoom = Math.min( cameraZoom, MAX_ZOOM )
        cameraZoom = Math.max( cameraZoom, MIN_ZOOM )
        
        console.log(zoomAmount)
    }
}

canvas.addEventListener('mousedown', onPointerDown)
canvas.addEventListener('touchstart', (e) => handleTouch(e, onPointerDown))
canvas.addEventListener('mouseup', onPointerUp)
canvas.addEventListener('touchend',  (e) => handleTouch(e, onPointerUp))
canvas.addEventListener('mousemove', onPointerMove)
canvas.addEventListener('touchmove', (e) => handleTouch(e, onPointerMove))
canvas.addEventListener( 'wheel', (e) => adjustZoom(e.deltaY*SCROLL_SENSITIVITY))

// Ready, set, go
draw()