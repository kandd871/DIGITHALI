class FloatingCanvas {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'canvas-wrapper';
        
        // Add user-select: none to the wrapper
        this.wrapper.style.userSelect = 'none';
        this.wrapper.style.webkitUserSelect = 'none';
        this.wrapper.style.msUserSelect = 'none';
        
        this.container.appendChild(this.wrapper);
        
        // State management
        this.offset = { x: 0, y: 0 };
        this.scrollOffset = { x: 0, y: 0 };
        this.isDragging = false;
        this.cards = [];
        this.columnWidth = (window.innerWidth * 0.16);
        this.gutter = 16;
        this.filterContainer = document.querySelector('.filter-items');
        // Layout tracking
        this.columnHeights = new Map();
        this.columnElements = new Map();
        this.visibleColumns = new Set();

        // Pagination and loading state
        this.page = 1;
        this.isLoading = false;
        this.hasMore = true;
        this.itemsPerPage = 50; // Increased from 20 to ensure at least 10 per column
        this.loadThreshold = 40;
        this.repeatCount = 0;

        // Google Sheets configuration
        this.sheetID = "1bT4kLhfWLxU1ZYFVyhAbR1BKvAZFVx0I21GtZf80juw";
        this.tabName = 'Sheet1';
        this.opensheet_uri = `https://opensheet.elk.sh/${this.sheetID}/${this.tabName}`;

        // Smooth scrolling with improved parameters
        this.scrollVelocity = { x: 0, y: 0 };
        this.isScrolling = false;
        this.scrollSpeed = 40;
        this.scrollDecay = 0.8;
        this.dragVelocity = { x: 0, y: 0 };
        this.lastDragTime = null;
        this.dragMultiplier = 0.9;
        this.velocityHistory = [];
        this.velocityHistorySize = 3;

        // Zoom settings
        this.scale = 1;
        this.minScale = 0.5;
        this.maxScale = 2;
        this.targetScale = 1;
        this.zoomSpeed = 0.1;
        this.zoomDecay = 0.3;

        // Track if we're inside the canvas area
        this.isInsideCanvas = false;

        // Filter-related properties
        this.filteredData = []; // Initialize filteredData as an empty array
        this.currentFilters = new Set(); // Stores the currently applied filters
        this.activeFilters = new Set(); // Stores active filter values

        this.setupEventListeners();
        this.loadInitialData();
        this.startAnimation();
        
        this.addGlobalStyles();
    }    addGlobalStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .canvas-wrapper {
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
            }
            .card, .card-media, .media-element {
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                -webkit-user-drag: none;
                -khtml-user-drag: none;
                -moz-user-drag: none;
                -o-user-drag: none;
                user-drag: none;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }

    async loadInitialData() {
        try {
            const response = await fetch(this.opensheet_uri);
            this.allData = await response.json();
            
            // Calculate initial load count based on visible columns to ensure at least 10 per column
            const containerWidth = this.container.clientWidth;
            const visibleColumnCount = Math.ceil(containerWidth / (this.columnWidth + this.gutter));
            const initialLoadCount = Math.min(visibleColumnCount * 10, this.allData.length);
            
            this.cardData = this.allData.slice(0, initialLoadCount);
            this.filteredData = [...this.allData]; // Initialize filteredData with a copy of allData
            
            await this.initializeGrid();
            this.centerCanvas();
            
            requestAnimationFrame(() => {
                this.checkLoadMore();
            });

             // Set up filter-related event listeners
             this.setupFilterEventListeners();

            // Add random images to info plate on first click only
            let hasAddedImages = false;
            document.addEventListener('click', () => {
                const infoPlate = document.querySelector('.info-plate');
                if (!hasAddedImages && infoPlate && this.allData) {
                    hasAddedImages = true;
                    setTimeout(() => {
                        const existingImages = infoPlate.querySelectorAll('.random-image');
                        existingImages.forEach(img => img.remove());
    
                        // Get 19 random images (13 + 5 + 1)
                        const randomImages = [...this.allData]
                            .sort(() => Math.random() - 0.5)
                            .slice(0, 19);
    
                        // Get plate dimensions and ensure consistent sizing
                        const plateRect = infoPlate.getBoundingClientRect();
                        const minDimension = Math.min(plateRect.width, plateRect.height);
                        const centerX = plateRect.width / 2;
                        const centerY = plateRect.height * 0.41; // Move images higher up
                        
                        // Fixed square image size based on minimum dimension
                        const imageSize = minDimension * 0.17;

                        // Match info plate's elliptical shape
                        const outerRadiusX = plateRect.width * 0.4;
                        const outerRadiusY = plateRect.height * 0.3;
                        const innerRadiusX = plateRect.width * 0.2;
                        const innerRadiusY = plateRect.height * 0.15;

                        const createSquareImage = (src) => {
                            const container = document.createElement('div');
                            container.className = 'random-image-container';
                            container.style.width = `${imageSize}px`;
                            container.style.height = `${imageSize}px`;
                            container.style.position = 'absolute';
                            container.style.overflow = 'hidden';
                            container.style.borderRadius = '4px';

                            const img = document.createElement('img');
                            img.src = src;
                            img.className = 'random-image';
                            img.style.width = '100%';
                            img.style.height = '100%';
                            img.style.objectFit = 'cover';
                            
                            container.appendChild(img);
                            return container;
                        };
                        
                        // Outer layer - 13 images following elliptical path
                        for (let i = 0; i < 13; i++) {
                            const angle = (i / 13) * 2 * Math.PI;
                            const container = createSquareImage(randomImages[i].img);
                            
                            const x = centerX + (outerRadiusX * Math.cos(angle));
                            const y = centerY + (outerRadiusY * Math.sin(angle));
                            
                            container.style.left = `${x}px`;
                            container.style.top = `${y}px`;
                            container.style.transform = 'translate(-50%, -50%)';
                            container.style.transition = 'all 0.3s ease';
                            
                            const infoPlateTransform = window.getComputedStyle(infoPlate).transform;
                            const matrix = new DOMMatrix(infoPlateTransform);
                            const angle2 = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
                            container.style.transform += ` rotate(${-angle2}deg)`;
                            
                            infoPlate.appendChild(container);
                        }

                        // Inner layer - 5 images following elliptical path
                        for (let i = 0; i < 5; i++) {
                            const angle = (i / 5) * 2 * Math.PI;
                            const container = createSquareImage(randomImages[i + 13].img);
                            
                            const x = centerX + (innerRadiusX * Math.cos(angle));
                            const y = centerY + (innerRadiusY * Math.sin(angle));
                            
                            container.style.left = `${x}px`;
                            container.style.top = `${y}px`;
                            container.style.transform = 'translate(-50%, -50%)';
                            container.style.t