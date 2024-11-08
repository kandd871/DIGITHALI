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
        // Controls how much momentum is applied after dragging - lower values (closer to 0) mean less momentum, higher values (closer to 1) mean more momentum
        this.dragMultiplier = 0.88;
        this.velocityHistory = [];
        this.velocityHistorySize = 3;

        // Zoom settings
        this.scale = 1;
        this.minScale = 0.5;
        this.maxScale = 2;
        this.targetScale = 1;
        this.zoomSpeed = 0.15;
        this.zoomDecay = 0.3;
        this.zoomOrigin = { x: 0, y: 0 }; 

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

                        // Get unique topics and types
                        const topics = [...new Set(this.allData.map(item => item.topic))];
                        const types = [...new Set(this.allData.map(item => item.type))];
                        
                        // Get one image from each topic first
                        let randomImages = [];
                        topics.forEach(topic => {
                            const topicImages = this.allData.filter(item => item.topic === topic);
                            randomImages.push(topicImages[Math.floor(Math.random() * topicImages.length)]);
                        });

                        // If we need more images, get one from each type that hasn't been used
                        if (randomImages.length < 15) {
                            const usedTypes = new Set(randomImages.map(img => img.type));
                            types.forEach(type => {
                                if (!usedTypes.has(type) && randomImages.length < 15) {
                                    const typeImages = this.allData.filter(item => 
                                        item.type === type && 
                                        !randomImages.includes(item)
                                    );
                                    if (typeImages.length > 0) {
                                        randomImages.push(typeImages[Math.floor(Math.random() * typeImages.length)]);
                                    }
                                }
                            });
                        }

                        // If we still need more images, get random unused ones
                        while (randomImages.length < 15) {
                            const unusedImages = this.allData.filter(item => !randomImages.includes(item));
                            if (unusedImages.length === 0) break;
                            randomImages.push(unusedImages[Math.floor(Math.random() * unusedImages.length)]);
                        }
    
                        // Get plate dimensions and ensure consistent sizing
                        const centerX = 650;
                        const centerY = 310;
                        
                        // Fixed square image size based on viewport height
                        const imageSize = 170;

                        // Match info plate's elliptical shape
                        const outerRadiusX = 510;
                        const outerRadiusY = 210;

                        const createSquareImage = (src, cardData) => {
                            const container = document.createElement('div');
                            container.className = 'random-image-container';
                            container.style.width = `${imageSize}px`;
                            container.style.height = `${imageSize}px`;
                            container.style.position = 'absolute';
                            container.style.borderRadius = '4px';
                            container.style.opacity = '0';

                            const img = document.createElement('img');
                            img.src = src;
                            img.className = 'random-image';
                            img.style.width = '100%';
                            img.style.height = '100%';
                            img.style.objectFit = 'cover';
                            img.style.cursor = 'pointer';

                            container.appendChild(img);

                            // Add click handler for expanding and showing info box
                            img.addEventListener('click', (e) => {
                                e.stopPropagation();

                                // Get container position
                                const containerRect = container.getBoundingClientRect();
                                const windowHeight = window.innerHeight;
                                const containerCenterY = containerRect.top + (containerRect.height / 2.05);
                                const windowCenterY = windowHeight / 2.05;
                                const translateY = windowCenterY - containerCenterY;

                                // Calculate left position with padding
                                const leftPadding = 350;
                                const translateX = -(containerRect.left - leftPadding);

                                // Add expanded class and transform
                                container.classList.add('expanded');
                                const infoPlateTransform = window.getComputedStyle(infoPlate).transform;
                                const matrix = new DOMMatrix(infoPlateTransform);
                                const angle = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
                                container.style.transform = `scale(2.05) translate(${translateX/2.05}px, ${translateY/3.25}px) rotate(${-angle}deg)`;
                                container.style.zIndex = '1000';
                                container.style.transition = '0.5s';

                                // Dim all other images
                                const allImages = document.querySelectorAll('.random-image');
                                const navs = document.querySelectorAll('.nav');
                                const logos = document.querySelectorAll('.logo');
                                
                                allImages.forEach(image => {
                                    image.style.pointerEvents = 'none';
                                    if (image !== img) {
                                        image.classList.add('dim');
                                        
                                    }
                                });
                                
                                navs.forEach(nav => nav.classList.add('dim'));
                                logos.forEach(logo => logo.classList.add('dim'));

                                

                                // Update image styles when expanded
                                img.style.transition = '0.5s';
                                img.style.borderRadius = '2vw';
                                img.style.border = '.5px solid var(--pink)';
                                img.style.zIndex = '1001';

                                // Update info box
                                const infoBox = document.querySelector('.info-box');
                                if (infoBox) {
                                    infoBox.style.visibility = 'visible';
                                    infoBox.style.opacity = '1';
                                    
                                    // Update title
                                    const titleElement = infoBox.querySelector('.title');
                                    if (titleElement) {
                                        titleElement.textContent = cardData.Title || '';
                                    }

                                    // Update link
                                    const linkElement = infoBox.querySelector('.link a');
                                    if (linkElement && cardData.Link) {
                                        linkElement.href = cardData.Link;
                                    }

                                    // Update filters
                                    const filtersList = infoBox.querySelector('.filter-list');
                                    if (filtersList) {
                                        filtersList.innerHTML = '';

                                        if (cardData.Type) {
                                            const typeItem = document.createElement('div');
                                            typeItem.className = 'filter-list-item resource-type';
                                            typeItem.textContent = cardData.Type;
                                            filtersList.appendChild(typeItem);
                                        }

                                        if (cardData.Topic) {
                                            const topics = cardData.Topic.split(',').map(t => t.trim());
                                            topics.forEach(topic => {
                                                const topicItem = document.createElement('div');
                                                topicItem.className = 'filter-list-item topic';
                                                topicItem.textContent = topic;
                                                filtersList.appendChild(topicItem);
                                            });
                                        }

                                        if (cardData.Language) {
                                            const langValue = document.querySelector('.language .filter-value');
                                            if (langValue) {
                                                langValue.textContent = cardData.Language;
                                            }
                                        }

                                        if (cardData.Region) {
                                            const regionValue = document.querySelector('.region .filter-value'); 
                                            if (regionValue) {
                                                regionValue.textContent = cardData.Region;
                                            }
                                        }

                                        if (cardData.Keywords) {
                                            const keywords = cardData.Keywords.split(',').map(k => k.trim().replace(/['"]+/g, ''));
                                            keywords.forEach(keyword => {
                                                const keywordItem = document.createElement('div');
                                                keywordItem.className = 'filter-list-item';
                                                keywordItem.textContent = keyword;
                                                filtersList.appendChild(keywordItem);
                                            });
                                        }
                                    }

                                    // Update description
                                    const descElement = infoBox.querySelector('.desc');
                                    if (descElement) {
                                        descElement.textContent = cardData.ShortDesc || '';
                                    }
                                }

                                // Add click outside listener to close expanded view
                                const closeExpandedView = (event) => {
                                    if (!container.contains(event.target)) {
                                        const infoPlateTransform = window.getComputedStyle(infoPlate).transform;
                                const matrix = new DOMMatrix(infoPlateTransform);
                                const angle = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
                                        container.classList.remove('expanded');
                                        container.style.transform = `translate(-50%, -50%) rotate(${-angle}deg)`;
                                        container.style.zIndex = '';
                                        img.style.borderRadius = '10vw';
                                        img.style.border = 'none';
                                        
                                        // Remove dim class from all images
                                        const allImages = document.querySelectorAll('.random-image');
                                        allImages.forEach(image => {
                                            image.classList.remove('dim');
                                            image.style.pointerEvents = 'auto';
                                        });

                                         
                                navs.forEach(nav => nav.classList.remove('dim'));
                                logos.forEach(logo => logo.classList.remove('dim'));


                                        const infoBox = document.querySelector('.info-box');
                                        if (infoBox) {
                                            infoBox.style.visibility = 'hidden';
                                            infoBox.style.opacity = '0';
                                        }

                                        document.removeEventListener('click', closeExpandedView);
                                    }
                                };
                                
                                document.addEventListener('click', closeExpandedView);
                            });
                            
                            return container;
                        };
                        // Outer layer - 9 images following elliptical path
                        // Place 2 images on top and bottom of ellipse
                        for (let i = 0; i < 2; i++) {
                            const container = createSquareImage(randomImages[i].img, randomImages[i]);
                            
                            // Calculate angle for top and bottom (0° and 180°)
                            const angle = i * Math.PI;
                            
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

                        // Place 4 images on left side of ellipse - closer together
                        for (let i = 0; i < 5; i++) {
                            const container = createSquareImage(randomImages[i+2].img, randomImages[i+2]);
                            
                            // Calculate angle for left side (from 120° to 240°) - closer spread
                            const angle = (222 * Math.PI/180) + (i * (72 * Math.PI/180) / 3); // Reduced from 90° to 60° spread
                            
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

                        // Place 4 images on right side of ellipse - closer together
                        for (let i = 0; i < 5; i++) {
                            const container = createSquareImage(randomImages[i + 7].img, randomImages[i + 7]);
                            
                            // Calculate angle for right side (from -60° to 60°) - wider spread
                            const angle = (42 * Math.PI/180) + (i * (73 * Math.PI/180) / 3);
                            
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

                        // Inner layer - 4 images in a horizontal line
                        const innerLineWidth = imageSize * 3 + (imageSize * 0.5); // Total width with gaps
                        const startX = centerX - (innerLineWidth / 2) + (imageSize / 2);
                        // i+10 because we've already used indices 0-1 for top images,
                        // 2-5 for left side images, and 6-9 for right side images.
                        // So these inner horizontal images start at index 10
                        for (let i = 0; i < 3; i++) {
                            const container = createSquareImage(randomImages[i + 12].img, randomImages[i + 12]);
                            const x = startX + (i * (imageSize * 1.25)); // 1.5x imageSize for spacing
                            
                            container.style.left = `${x}px`;
                            container.style.top = `${centerY}px`;
                            container.style.transform = 'translate(-50%, -50%)';
                            container.style.transition = 'all 0.3s ease';
                            
                            const infoPlateTransform = window.getComputedStyle(infoPlate).transform;
                            const matrix = new DOMMatrix(infoPlateTransform);
                            const angle2 = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
                            container.style.transform += ` rotate(${-angle2}deg)`;
                            
                            infoPlate.appendChild(container);
                        }

                        // Center image
                        const centerContainer = createSquareImage(randomImages[15].img, randomImages[15]);
                        centerContainer.style.left = `${centerX}px`;
                        centerContainer.style.top = `${centerY}px`;
                        centerContainer.style.transform = 'translate(-50%, -50%)';
                        centerContainer.style.transition = 'all 0.3s ease';
                        
                        const infoPlateTransform = window.getComputedStyle(infoPlate).transform;
                        const matrix = new DOMMatrix(infoPlateTransform);
                        const angle2 = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
                        centerContainer.style.transform += ` rotate(${-angle2}deg)`;
                        
                        infoPlate.appendChild(centerContainer);

                    }, 1100);
                    setTimeout(() => {
                        const containers = document.querySelectorAll('.random-image-container');
                        const containerArray = Array.from(containers);
                        
                        // Top images (indices 0-1)
                        const topImages = containerArray.slice(0, 2);
                        
                        // Right side images (indices 6-9) 
                        const rightImages = containerArray.slice(6, 10);
                        
                        // Left side images (indices 2-5)
                        const leftImages = containerArray.slice(2, 6);
                        
                        // Middle line images (indices 10+)
                        const middleImages = containerArray.slice(10);
                        
                        // Reveal in sequence: top, right, left, middle
                        const sequence = [...topImages, ...rightImages, ...leftImages, ...middleImages];
                        
                        sequence.forEach((container, index) => {
                            setTimeout(() => {
                                container.style.transition = '0.75s';
                                container.style.opacity = '1';
                            }, index * 70); // 70ms delay between each image
                        });
                    }, 1100);
                }
            });

            

        } catch (err) {
            console.error("Error loading initial data:", err);
        }
    }

    setupFilterEventListeners() {
        const dropdownBtn = document.querySelector('.dropdown-btn');
        const dropdownContent = document.querySelector('.dropdown-content');
        const suboptions = document.querySelector('.sub-options');
        const filterContainer = document.querySelector('.filter-container');
        const filterItems = document.querySelector('.filter-items');

        // Track active filters
        this.activeFilters = new Set();

        suboptions.addEventListener('click', (e) => {
            if (e.target.classList.contains('suboption')) {
                const selectedValue = e.target.textContent;
                // Only add filter if it's not already active
                if (!this.activeFilters.has(selectedValue)) {
                    this.activeFilters.add(selectedValue);
                    this.applyAllFilters();
                    this.addFilterItem(selectedValue);
                }
            }
        });

        this.addFilterItem = (filterValue) => {
            const filterItem = document.createElement('div');
            filterItem.className = 'filter-item';
            
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove';
            removeBtn.textContent = '×';
            
            filterItem.appendChild(removeBtn);
            filterItem.appendChild(document.createTextNode(filterValue));
            
            removeBtn.addEventListener('click', () => {
                this.activeFilters.delete(filterValue);
                filterItem.remove();
                
                // Get current search term
                const searchTerm = document.getElementById('searchInput').value.toLowerCase();
                
                if (this.activeFilters.size === 0 && !searchTerm) {
                    // Reset to all data if no filters and no search
                    this.filteredData = this.allData;
                } else {
                    // Start with all data
                    let results = this.allData;
                    
                    // Apply search filter if exists
                    if (searchTerm) {
                        results = results.filter(item => {
                            if (!item.Keywords && !item.Topic && !item.Language && !item.Region && !item.Type) return false;
                            
                            const keywords = (item.Keywords || '').toLowerCase();
                            const topic = (item.Topic || '').toLowerCase();
                            const language = (item.Language || '').toLowerCase();
                            const region = (item.Region || '').toLowerCase();
                            const type = (item.Type || '').toLowerCase();
                            
                            return keywords.includes(searchTerm) || 
                                   topic.includes(searchTerm) || 
                                   language.includes(searchTerm) ||
                                   region.includes(searchTerm) ||
                                   type.includes(searchTerm);
                        });
                    }
                    
                    // Apply remaining category filters if any exist
                    if (this.activeFilters.size > 0) {
                        results = results.filter(item => {
                            return Array.from(this.activeFilters).some(filter => 
                                Object.values(item).some(value => 
                                    String(value).includes(filter)
                                )
                            );
                        });
                    }
                    
                    // If no results found, show all data
                    if (results.length === 0) {
                        results = this.allData;
                        // Clear filters since we're showing all data
                        this.activeFilters.clear();
                        // Remove all filter items from UI
                        filterItems.innerHTML = '';
                    }
                    
                    this.filteredData = results;
                }
                this.initializeGrid();
            });
            
            filterItems.appendChild(filterItem);
        };

        filterContainer.addEventListener('mouseleave', () => {
            dropdownContent.style.display = 'none';
        });
        // Add event listener for shuffle button
        const shuffleButton = document.querySelector('.shuffle');
        shuffleButton.addEventListener('click', () => {
            // Create a copy of filteredData and shuffle it randomly
            this.filteredData = [...this.filteredData].sort(() => Math.random() - 0.5);
            
            // Re-initialize grid with shuffled data
            this.initializeGrid();
            this.updateVisibleColumns();
        });
    }

    applyAllFilters() {
        // Start with all data
        this.filteredData = this.allData;
        
        // Apply each active filter sequentially
        for (const filter of this.activeFilters) {
            this.filteredData = this.filteredData.filter(item => {
                return Object.values(item).some(value => 
                    String(value).includes(filter)
                );
            });
        }

        // If no results found after filtering, show all data
        if (this.filteredData.length === 0) {
            this.filteredData = this.allData;
            // Clear filters since we're showing all data
            this.activeFilters.clear();
            // Remove all filter items from UI
            document.querySelector('.filter-items').innerHTML = '';
        }

        this.initializeGrid();
    }

    toggleFilter(filterId) {
        if (this.currentFilters.has(filterId)) {
            this.currentFilters.delete(filterId);
        } else {
            this.currentFilters.add(filterId);
        }
    }

    filterDataByValue(selectedValue) {
        this.filteredData = this.allData.filter(item => {
            return Object.values(item).some(value => 
                String(value).includes(selectedValue)
            );
        });

        // If no results found, show all data
        if (this.filteredData.length === 0) {
            this.filteredData = this.allData;
            // Clear filters since we're showing all data
            this.activeFilters.clear();
            // Remove all filter items from UI
            document.querySelector('.filter-items').innerHTML = '';
        }

        this.initializeGrid();
    }

    centerCanvas() {
        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;
        
        this.offset.x = containerWidth / 2;
        this.offset.y = 0;
        
        this.updatePosition();
        this.updateVisibleColumns();
    }

    async initializeGrid() {
        this.wrapper.innerHTML = '';
        this.cards = [];
        this.columnHeights.clear();
        this.columnElements.clear();
        this.visibleColumns.clear();

        // Always create at least 10 columns
        const minColumns = 10;
        const containerWidth = this.container.clientWidth;
        const effectiveWidth = containerWidth / this.scale;
        const visibleColumnCount = Math.max(minColumns, Math.ceil(effectiveWidth / (this.columnWidth + this.gutter)));
        const startColumn = -Math.floor(visibleColumnCount / 2) - 5;
        const endColumn = Math.floor(visibleColumnCount / 2) + 5;

        for (let i = startColumn; i <= endColumn; i++) {
            this.createColumn(i);
            this.visibleColumns.add(i);
        }

        // Ensure we have at least 100 items (10 per column x 10 columns)
        const minItems = 100;
        let dataToLayout = [...this.filteredData];
        while (dataToLayout.length < minItems) {
            dataToLayout = dataToLayout.concat(this.filteredData);
        }
        dataToLayout = dataToLayout.slice(0, Math.max(minItems, this.filteredData.length));

        await this.layoutNewCards(dataToLayout);

        // Center the canvas after the new cards are rendered
        this.centerCanvas();

        // Update the visible columns after the new cards are rendered
        this.updateVisibleColumns();
    }
    createColumn(index) {
        if (!this.columnElements.has(index)) {
            const column = document.createElement('div');
            column.className = 'grid-column';
            column.style.width = `${this.columnWidth}px`;
            column.style.position = 'absolute';
            column.style.left = `${index * (this.columnWidth + this.gutter)}px`;
            column.dataset.columnIndex = index;
            this.wrapper.appendChild(column);
            this.columnElements.set(index, column);
            this.columnHeights.set(index, 0);
        }
        return this.columnElements.get(index);
    }

    createMediaElement(obj) {
        const mediaContainer = document.createElement('div');
        mediaContainer.className = 'card-media';
    
        let element;
    
        if (obj.img.includes("i.ytimg.com")) {
            const videoID = obj.img.split("/vi/")[1].split("/")[0];
            element = document.createElement('iframe');
            element.src = `https://www.youtube.com/embed/${videoID}?autoplay=0&mute=1`;
            element.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
            element.allowFullscreen = true;
        } else if (obj.img.includes("tiktok.com")) {
            element = document.createElement('div');
            element.innerHTML = obj.img;
        } else if (obj.img.includes("instagram.com")) {
            element = document.createElement('div');
            element.innerHTML = obj.img;
        } else if (obj.img.includes("redd.it")) {
            element = document.createElement('video');
            element.src = obj.img;
            element.controls = true;
            element.autoplay = true;
            element.loop = true;
            element.muted = true;
        } else {
            element = document.createElement('img');
            element.src = obj.img;
            element.alt = obj.Title || '';
        }
    
        element.className = "media-element";
        mediaContainer.appendChild(element);
        return mediaContainer;
    }

    async layoutCards() {
        if (!this.cardData) return;
        await this.layoutNewCards(this.cardData);
    }

    async layoutNewCards(newCards) {
        // Track if any card is currently expanded
        let isAnyCardExpanded = false;

        for (let cardData of newCards) {
            const card = document.createElement('div');
            card.className = 'card';
            
            const mediaElement = this.createMediaElement(cardData);
            card.appendChild(mediaElement);

            // Add click event listener for expanding media
            card.addEventListener('click', () => {
                // Only allow expanding if no card is expanded and not currently dragging/scrolling
                if (!isAnyCardExpanded && !this.isDragging) {
                    isAnyCardExpanded = true;

                    // Add expanded class instead of changing position
                    card.classList.add('expanded');
                    
                    // Calculate position to center vertically and move to left
                    const cardRect = card.getBoundingClientRect();
                    const windowHeight = window.innerHeight;
                    const cardCenterY = cardRect.top + (cardRect.height / 2);
                    const windowCenterY = windowHeight / 2;
                    const translateY = windowCenterY - cardCenterY;
                    
                    // Calculate left position with some padding
                    const leftPadding = 350; // 20px padding from left edge
                    const translateX = -(cardRect.left - leftPadding);

                    // Apply transform with scale, vertical centering and left positioning
                    card.style.transform = `scale(2.05) translate(${translateX/2.05}px, ${translateY/2.05}px)`;
                    card.style.zIndex = '1000';
                    card.style.transition = ' .5s';

                    // Update border radius of media element when expanded with transition
                    const mediaElement = card.querySelector('.media-element');
                    if (mediaElement) {
                        mediaElement.style.transition = '0.5s';
                        mediaElement.style.borderRadius = '2vw';
                        mediaElement.style.border = '.5px solid var(--pink)';
                    }

                    // Update info box with card data
                    const infoBox = document.querySelector('.info-box');
                    if (infoBox) {
                        infoBox.style.visibility = 'visible';
                        infoBox.style.opacity = '1';
                        // Update title
                        const titleElement = infoBox.querySelector('.title');
                        if (titleElement) {
                            titleElement.textContent = cardData.Title || '';
                        }

                        // Update link if exists
                        const linkElement = infoBox.querySelector('.link a');
                        if (linkElement && cardData.Link) {
                            linkElement.href = cardData.Link;
                            // linkElement.textContent = cardData.Link;
                        }

                        // Update filters info
                        const filtersList = infoBox.querySelector('.filter-list');
                        if (filtersList) {
                            filtersList.innerHTML = ''; // Clear existing filters

                            // Add Type if exists
                            if (cardData.Type) {
                                const typeItem = document.createElement('div');
                                typeItem.className = 'filter-list-item resource-type';
                                typeItem.textContent = cardData.Type;
                                filtersList.appendChild(typeItem);
                            }

                            // Add Topics if exists
                            if (cardData.Topic) {
                                const topics = cardData.Topic.split(',').map(t => t.trim());
                                topics.forEach(topic => {
                                    const topicItem = document.createElement('div');
                                    topicItem.className = 'filter-list-item topic';
                                    topicItem.textContent = topic;
                                    filtersList.appendChild(topicItem);
                                });
                            }

                            if (cardData.Language) {
                                const langValue = document.querySelector('.language .filter-value');
                                if (langValue) {
                                    langValue.textContent = cardData.Language;
                                }
                            }

                            if (cardData.Region) {
                                const regionValue = document.querySelector('.region .filter-value'); 
                                if (regionValue) {
                                    regionValue.textContent = cardData.Region;
                                }
                            }
   // Add Keywords if exists
                            if (cardData.Keywords) {
                                const keywords = cardData.Keywords.split(',').map(k => k.trim().replace(/['"]+/g, ''));
                                keywords.forEach(keyword => {
                                    const keywordItem = document.createElement('div');
                                    keywordItem.className = 'filter-list-item';
                                    keywordItem.textContent = keyword;
                                    filtersList.appendChild(keywordItem);
                                });
                            }
                        }

                        // Update description if exists
                        const descElement = infoBox.querySelector('.desc');
                        if (descElement) {
                            descElement.textContent = cardData.ShortDesc || '';
                        }
                    }

                    document.querySelector('.filters').classList.add('dim');

                    // Dim other cards
                    const allCards = document.querySelectorAll('.card');
                    allCards.forEach(otherCard => {
                        if (otherCard !== card) {
                            otherCard.classList.add('dim');
                        }
                    });

                    // Add click outside listener to restore
                    const closeHandler = (e) => {
                        if (!card.contains(e.target)) {
                            // Reset transform and remove expanded class
                            card.style.transform = '';
                            card.style.zIndex = '';
                            card.classList.remove('expanded');
                            
                            // Reset border radius of media element
                            const mediaElement = card.querySelector('.media-element');
                            setTimeout(() => {
                            if (mediaElement) {
                                mediaElement.style.transition = '0.5s!important';
                                mediaElement.style.borderRadius = '10vw';
                                mediaElement.style.border = '0px solid var(--pink)';
                            }
                            }, 300);

                            infoBox.style.visibility = 'hidden';
                            infoBox.style.opacity = '0';

                            // Remove dim from other cards
                            allCards.forEach(otherCard => {
                                otherCard.classList.remove('dim');
                            });

                            document.querySelector('.filters').classList.remove('dim');

                            isAnyCardExpanded = false;
                            document.removeEventListener('click', closeHandler);
                        }
                    };
                    
                    // Delay adding click handler to prevent immediate close
                    setTimeout(() => {
                        document.addEventListener('click', closeHandler);
                    }, 0);
                }
            });

            const shortestColumnIndex = this.getShortestVisibleColumn();
            const column = this.createColumn(shortestColumnIndex);
            column.appendChild(card);

            await this.updateCardHeight(card, cardData, shortestColumnIndex);
            this.cards.push(card);
        }
    }

    async updateCardHeight(card, cardData, columnIndex) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const aspectRatio = img.naturalHeight / img.naturalWidth;
                const height = this.columnWidth * aspectRatio;
                card.style.height = `${height}px`;
                this.columnHeights.set(columnIndex, (this.columnHeights.get(columnIndex) || 0) + height + this.gutter);
                resolve();
            };
            img.onerror = () => {
                card.style.height = '100px';
                this.columnHeights.set(columnIndex, (this.columnHeights.get(columnIndex) || 0) + 100 + this.gutter);
                resolve();
            };
            img.src = cardData.img;
        });
    }

    getShortestVisibleColumn() {
        let shortestHeight = Infinity;
        let shortestIndex = Math.min(...this.visibleColumns);
        
        for (const columnIndex of this.visibleColumns) {
            const height = this.columnHeights.get(columnIndex) || 0;
            if (height < shortestHeight) {
                shortestHeight = height;
                shortestIndex = columnIndex;
            }
        }
        return shortestIndex;
    }

    updateVisibleColumns() {
        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;
        
        // Calculate the effective viewport size considering zoom
        const effectiveWidth = containerWidth / this.scale;
        const effectiveHeight = containerHeight / this.scale;
        
        // Calculate the effective offset considering zoom
        const effectiveOffsetX = -this.offset.x / this.scale;
        
        // Calculate visible column range with increased buffer for zoomed out view
        const extraBufferColumns = Math.ceil(8 / this.scale);
        const startColumn = Math.floor(effectiveOffsetX / (this.columnWidth + this.gutter)) - extraBufferColumns;
        const endColumn = Math.ceil((effectiveOffsetX + effectiveWidth) / (this.columnWidth + this.gutter)) + extraBufferColumns;
        
        const newVisibleColumns = new Set();
        for (let i = startColumn; i <= endColumn; i++) {
            newVisibleColumns.add(i);
            if (!this.columnElements.has(i)) {
                this.createColumn(i);
            }
        }
        
        this.visibleColumns = newVisibleColumns;
    }

    shouldLoadMore() {
        if (!this.columnHeights.size) return true;
        
        const containerHeight = this.container.clientHeight;
        const effectiveHeight = containerHeight / this.scale;
        const shortestColumnHeight = Math.min(...Array.from(this.columnHeights.values()));
        
        // Adjust threshold based on scale
        const heightThreshold = effectiveHeight * 1.5 / this.scale;
        
        return shortestColumnHeight < heightThreshold;
    }

    async loadMoreData() {
        if (this.isLoading) return false;

        this.isLoading = true;
        const start = this.page * this.itemsPerPage;
        
        // Calculate how many items to load based on scale
        const scaledItemsPerPage = Math.ceil(this.itemsPerPage / this.scale);
        
        let newData;
        if (start >= this.filteredData.length) {
            this.page = 0;
            this.repeatCount++;
            newData = this.filteredData.slice(0, scaledItemsPerPage).map(item => ({
                ...item,
                repeatId: `repeat-${this.repeatCount}-${item.id || Math.random()}`
            }));
        } else {
            newData = this.filteredData.slice(start, start + scaledItemsPerPage);
        }

        this.cardData = [...this.cardData, ...newData];
        this.page++;
        
        await this.layoutNewCards(newData);
        this.isLoading = false;

        const containerHeight = this.container.clientHeight;
        const effectiveHeight = containerHeight / this.scale;
        const shortestColumnHeight = Math.min(...Array.from(this.columnHeights.values()));
        
        return shortestColumnHeight < effectiveHeight * 1.5;
    }

    setupEventListeners() {
        // Mouse events
        this.container.addEventListener('mousedown', (e) => {
            if (!document.querySelector('.card.expanded')) {
                this.startDragging(e);
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!document.querySelector('.card.expanded')) {
                this.handleMouseMove(e);
            }
        });

        window.addEventListener('mouseup', () => {
            if (!document.querySelector('.card.expanded') && this.isDragging) {
                const avgVelocity = this.calculateAverageVelocity();
                this.scrollVelocity.x = -avgVelocity.x * this.dragMultiplier;
                this.scrollVelocity.y = -avgVelocity.y * this.dragMultiplier;
                this.isScrolling = true;
            }
            this.isDragging = false;
            this.lastX = null;
            this.lastY = null;
            this.velocityHistory = [];
        });

        // Touch events 
        this.container.addEventListener('touchstart', (e) => {
            if (!document.querySelector('.card.expanded')) {
                e.preventDefault();
                const touch = e.touches[0];
                this.startDragging({ clientX: touch.clientX, clientY: touch.clientY });
            }
        });

        window.addEventListener('touchmove', (e) => {
            if (!document.querySelector('.card.expanded') && this.isDragging) {
                e.preventDefault();
                const touch = e.touches[0];
                this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
            }
        });

        window.addEventListener('touchend', () => {
            if (!document.querySelector('.card.expanded') && this.isDragging) {
                const avgVelocity = this.calculateAverageVelocity();
                this.scrollVelocity.x = -avgVelocity.x * this.dragMultiplier;
                this.scrollVelocity.y = -avgVelocity.y * this.dragMultiplier;
                this.isScrolling = true;
            }
            this.isDragging = false;
            this.lastX = null;
            this.lastY = null;
            this.velocityHistory = [];
        });

        // Track when mouse enters/leaves canvas
        this.container.addEventListener('mouseenter', () => {
            if (!document.querySelector('.card.expanded')) {
                this.isInsideCanvas = true;
            }
        });
        
        this.container.addEventListener('mouseleave', () => {
            if (!document.querySelector('.card.expanded')) {
                this.isInsideCanvas = false;
            }
        });

        this.container.addEventListener('wheel', (e) => {
            if (!document.querySelector('.card.expanded')) {
                this.handleWheel(e);
            }
        }, { passive: false });

        window.addEventListener('resize', (e) => {
            if (!document.querySelector('.card.expanded')) {
                this.handleResize(e);
            }
        });

        // Dropdown filtering event listeners
        const dropdownBtn = document.querySelector('.dropdown-btn');
        const dropdownContent = document.querySelector('.dropdown-content');
        const suboptions = document.querySelector('.sub-options');
        const filterContainer = document.querySelector('.filter-container');

        // Create invisible bridge element between dropdownBtn and dropdownContent
        const topBridge = document.createElement('div');
        topBridge.style.position = 'absolute';
        topBridge.style.width = '100%';
        topBridge.style.height = '7vh'; // Match gap to top value in CSS
        topBridge.style.top = '-7vh';
        dropdownContent.appendChild(topBridge);

        dropdownBtn.addEventListener('mouseover', () => {
            dropdownContent.style.display = 'flex';
        });

        topBridge.addEventListener('mouseover', () => {
            dropdownContent.style.display = 'flex';
        });

        dropdownContent.addEventListener('mouseover', () => {
            dropdownContent.style.display = 'flex';
        });

        suboptions.addEventListener('mouseover', () => {
            dropdownContent.style.display = 'flex';
            suboptions.style.display = 'flex';
        });

        // Create invisible bridge element between dropdownContent and suboptions
        const sideBridge = document.createElement('div');
        sideBridge.style.position = 'absolute';
        sideBridge.style.width = '2vw'; // Width of gap between elements
        sideBridge.style.height = '100%';
        sideBridge.style.right = '-2vw';
        sideBridge.style.top = '0';
        dropdownContent.appendChild(sideBridge);

        sideBridge.addEventListener('mouseover', () => {

        });

        filterContainer.addEventListener('mouseleave', () => {
            suboptions.style.display = 'none';
        });

        // dropdownContent.addEventListener('mouseout', () => {
        //     dropdownContent.style.display = 'none';
        //     // suboptions.style.display = 'none';
        // });
        dropdownContent.addEventListener('mouseover', (e) => {
            if (e.target.classList.contains('filter-option')) {
                const filterId = e.target.id;
                const valueMap = new Map();

                if (this.allData && Array.isArray(this.allData)) {
                    this.allData.forEach(item => {
                        if (item && item.hasOwnProperty(filterId) && item[filterId] !== null && item[filterId] !== undefined) {
                            if (filterId === 'Topic') {
                                const topics = item[filterId].split(',').map(t => t.trim());
                                topics.forEach(topic => {
                                    valueMap.set(topic, (valueMap.get(topic) || 0) + 1);
                                });
                            } else {
                                const value = item[filterId];
                                valueMap.set(value, (valueMap.get(value) || 0) + 1);
                            }
                        }
                    });
                }

                const allValues = Array.from(valueMap.keys());
                suboptions.innerHTML = '';
                allValues.forEach(value => {
                    const option = document.createElement('button');
                    option.className = 'suboption';
                    option.textContent = value;
                    suboptions.appendChild(option);
                });

                suboptions.style.display = 'flex';
            }
        });

        // Combined filtering function
        const applyFilters = () => {
            let filteredResults = this.allData;
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();

            // Always apply search filter first if it exists
            if (searchTerm) {
                const searchResults = filteredResults.filter(item => {
                    if (!item.Keywords && !item.Topic && !item.Language && !item.Region && !item.Type) return false;
                    
                    const keywords = (item.Keywords || '').toLowerCase();
                    const topic = (item.Topic || '').toLowerCase();
                    const language = (item.Language || '').toLowerCase();
                    const region = (item.Region || '').toLowerCase();
                    const type = (item.Type || '').toLowerCase();
                    
                    return keywords.includes(searchTerm) || 
                           topic.includes(searchTerm) || 
                           language.includes(searchTerm) ||
                           region.includes(searchTerm) ||
                           type.includes(searchTerm);
                });

                // If no search results, keep all data for category filtering
                if (searchResults.length === 0) {
                    document.getElementById('searchInput').value = '';
                } else {
                    filteredResults = searchResults;
                }
            }

            // Then apply category filters if any exist
            if (this.activeFilters && this.activeFilters.size > 0) {
                const categoryResults = filteredResults.filter(item => {
                    return Array.from(this.activeFilters).some(filter => 
                        Object.values(item).some(value => 
                            String(value).includes(filter)
                        )
                    );
                });

                // If no matches with category filters, show all data for those categories
                if (categoryResults.length === 0) {
                    // Clear only category filters
                    this.activeFilters.clear();
                    document.querySelector('.filter-items').innerHTML = '';
                    // Keep search results if they exist
                    filteredResults = searchTerm ? filteredResults : this.allData;
                } else {
                    filteredResults = categoryResults;
                }
            }

            this.filteredData = filteredResults;
            this.initializeGrid();
            this.updateVisibleColumns();
        };

        // Update suboptions click handler
        suboptions.addEventListener('click', (e) => {
            if (e.target.classList.contains('suboption')) {
                const selectedValue = e.target.textContent;
                if (!this.activeFilters.has(selectedValue)) {
                    this.activeFilters.add(selectedValue);
                    this.addFilterItem(selectedValue);
                }
                applyFilters();
                this.checkLoadMore();
                this.loadMoreData();
            }
        });

        // Update search input handler
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('blur', () => {
            applyFilters();
        });
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                applyFilters();
                searchInput.blur();
            }
        });
    }

    async filterDataByValue(selectedValue) {
        this.activeFilters.add(selectedValue);
        applyFilters();
    }

    calculateAverageVelocity() {
        if (this.velocityHistory.length === 0) return { x: 0, y: 0 };
        
        const sum = this.velocityHistory.reduce((acc, curr) => ({
            x: acc.x + curr.velocity.x,
            y: acc.y + curr.velocity.y
        }), { x: 0, y: 0 });
        
        return {
            x: sum.x / this.velocityHistory.length,
            y: sum.y / this.velocityHistory.length
        };
    }

    startDragging(e) {
        if (e.button === 0 || e.touches) {
            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            this.scrollVelocity = { x: 0, y: 0 };
            this.lastDragTime = Date.now();
            this.isScrolling = false;
            this.velocityHistory = [];
        }
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;

        const now = Date.now();
        const deltaTime = now - this.lastDragTime;
        if (deltaTime === 0) return;

        const deltaX = e.clientX - this.lastX;
        const deltaY = e.clientY - this.lastY;

        // Calculate instantaneous velocity
        const velocity = {
            x: deltaX / deltaTime * 16, // Normalize to roughly 60fps
            y: deltaY / deltaTime * 16
        };

        // Add to velocity history
        this.velocityHistory.push({
            velocity,
            time: now
        });

        // Keep only recent velocity samples
        if (this.velocityHistory.length > this.velocityHistorySize) {
            this.velocityHistory.shift();
        }

        // Allow horizontal scrolling without restriction
        this.offset.x += deltaX;

        // Allow vertical scrolling with restriction
        const newOffsetY = this.offset.y + deltaY;
        this.offset.y = Math.min(0, newOffsetY);

        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.lastDragTime = now;

        this.updatePosition();
        this.updateVisibleColumns();
        this.checkLoadMore();
    }

    handleWheel(e) {
        if (!this.isInsideCanvas) {
            return; // Allow normal page scrolling when outside canvas
        }
        
        e.preventDefault();
        
        if (e.ctrlKey || e.metaKey || e.deltaY % 1 !== 0) {
            // Detect pinch-to-zoom or two-finger scrolling (touchpad zoom)
            const zoomDelta = -e.deltaY * 0.002; // Base zoom delta
            
            // Calculate target scale with momentum
            this.targetScale = Math.min(this.maxScale, 
                                      Math.max(this.minScale, 
                                      this.targetScale + zoomDelta));
            
            // Check for loading more content when zooming
            this.checkLoadMore();
        } else {
            // Regular scrolling
            this.scrollVelocity.x += e.deltaX / this.scrollSpeed;
            this.scrollVelocity.y += e.deltaY / this.scrollSpeed;
            this.isScrolling = true;
            this.updateVisibleColumns();
            this.checkLoadMore();
        }
    
        this.updatePosition();
    }

    startAnimation() {
        const animate = () => {
            // Handle scrolling animation
            if (this.isScrolling && !this.isDragging) {
                // Update horizontal position without restriction
                this.offset.x -= this.scrollVelocity.x;

                // Update vertical position with restriction
                const newOffsetY = this.offset.y - this.scrollVelocity.y;
                this.offset.y = Math.min(0, newOffsetY);

                // If we hit the top boundary, stop vertical scrolling
                if (this.offset.y === 0 && this.scrollVelocity.y < 0) {
                    this.scrollVelocity.y = 0;
                }

                this.scrollVelocity.x *= this.scrollDecay;
                this.scrollVelocity.y *= this.scrollDecay;

                if (Math.abs(this.scrollVelocity.x) < 0.01 && Math.abs(this.scrollVelocity.y) < 0.01) {
                    this.isScrolling = false;
                    this.scrollVelocity = { x: 0, y: 0 };
                }

                this.updateVisibleColumns();
                this.checkLoadMore();
            }

            // Handle zoom animation
            if (this.scale !== this.targetScale) {
                // Get mouse position relative to container
                const containerRect = this.container.getBoundingClientRect();
                const mouseX = this.isInsideCanvas ? this.zoomOrigin.x : containerRect.width / 2;
                const mouseY = this.isInsideCanvas ? this.zoomOrigin.y : containerRect.height / 2;

                // Convert mouse position to canvas coordinates before zoom
                const canvasX = (mouseX - this.offset.x) / this.scale;
                const canvasY = (mouseY - this.offset.y) / this.scale;

                // Calculate zoom scale difference
                const scaleDiff = this.targetScale - this.scale;
                this.scale += scaleDiff * this.zoomSpeed;

                // Adjust offset to keep mouse position fixed during zoom
                this.offset.x = mouseX - canvasX * this.scale;
                this.offset.y = mouseY - canvasY * this.scale;

                // Check for loading more content when zooming
                this.checkLoadMore();
            }

            // Update position if either scrolling or zooming occurred
            if (this.isScrolling || this.scale !== this.targetScale) {
                this.updatePosition();
            }

            requestAnimationFrame(animate);
        };
        animate();
    }

    handleResize() {
        this.columnWidth = (window.innerWidth * 0.16);
        this.initializeGrid();
    }

    checkLoadMore() {
        if (this.shouldLoadMore() && !this.isLoading) {
            this.loadMoreData();
        }
    }

    updatePosition() {
        requestAnimationFrame(() => {
            // Apply both pan (offset) and zoom (scale)
            this.wrapper.style.transform = `translate3d(${this.offset.x}px, ${this.offset.y}px, 0) scale(${this.scale})`;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new FloatingCanvas();

    const text = document.querySelector('#text1');
    const infoPlate = document.querySelector('.info-plate');
    const logo = document.querySelector('#logo');
    const landingpage = document.querySelector('#landing');
    const logo1 = document.querySelector('#logo1');
    const navs = document.querySelectorAll('.nav');

    const randomRotation = Math.random() * 30 - 15; // Random value between -20 and 20

    const blurb1 = document.querySelector('#blurb1');
    const blurb2 = document.querySelector('#blurb2');

    infoPlate.style.transform = `translate(-50%, -50%) rotate(${randomRotation}deg)`;
    
    // Add click handler to hide landing content
    let hasClicked = false;
    let hasClickedAfterInfo = false;
    document.addEventListener('click', () => {
        if (!hasClicked && text && infoPlate) {
            hasClicked = true;

            // Hide text
            text.style.opacity = '0';
            text.style.visibility = 'hidden';
            
            // Adjust info plate size and rotation
            infoPlate.style.width = '90vw';
            infoPlate.style.height = '80vh';
            const randomRotation2 = Math.random() * 20 - 20;
            infoPlate.style.transform = `translate(-50%, -50%) rotate(${randomRotation2}deg)`;
            
            // Move logo to top left
            logo1.classList.add('move-logo');
            logo.style.fill = 'var(--green';
            logo1.style.width = '15vw';

            setTimeout(() => {
                text.style.display = 'none';
            }, 1000);

            navs.forEach(nav => {
                nav.style.opacity = '1';
            });
        }
    });

    // Add click handler for "all" button to scroll to canvas
    const allButton = document.querySelector('#all');
    const canvasContainer = document.querySelector('#canvas-container');
    const info = document.querySelector('#info');
    const logoSecond = document.querySelector('.logosecond');
    
    let hasOpenedCanvas = false;

    allButton.addEventListener('click', () => {
        if (!hasOpenedCanvas) {
            // First time opening
            canvasContainer.scrollIntoView({ behavior: 'smooth' });
            landingpage.style.height = '0vh';
            canvasContainer.style.display = 'block';
            logo1.style.opacity = '0';
            logoSecond.style.opacity = '1';
            hasOpenedCanvas = true;
        } else {
            // Subsequent times
            canvasContainer.style.display = 'block';
            requestAnimationFrame(() => {
                landingpage.style.height = '0vh';
                logo1.style.opacity = '0';
                logoSecond.style.opacity = '1';
            });
        }
    });

    logoSecond.addEventListener('click', () => {
        landingpage.style.height = '100vh';
        logo1.style.opacity = '1';
        logoSecond.style.opacity = '0';
        // canvasContainer.style.display = 'none';
    });
    
    info.addEventListener('click', () => {
        hasClickedAfterInfo = false;
        // Reset plate rotation and position
        infoPlate.style.transform = 'translate(-50%, -50%) rotate(0deg)';
        infoPlate.style.width = '92vw';
        infoPlate.style.height = '93vh';

        // Reset logo position and style
        logo1.classList.remove('move-logo');
        logo.style.fill = 'var(--pink)';
        logo1.style.width = '';
        
        // Show text content
        setTimeout(() => {
            text.style.display = 'block';
            text.style.visibility = 'visible';
            setTimeout(() => {
                text.style.opacity = '1';
            }, 100);
        }, 100);

        // Hide navigation elements
        navs.forEach(nav => {
            nav.style.opacity = '0';
        });
        // Hide all images within info plate
        const images = infoPlate.querySelectorAll('img, iframe, video');
        images.forEach(img => img.style.opacity = '0');
    });

    // Add click handler to document to revert info plate changes
    document.addEventListener('click', (e) => {
        // Ignore clicks on the info button itself
        if (e.target === info) return;
        hasOpenedCanvas = true;

        if (!hasClickedAfterInfo) {
            hasClickedAfterInfo = true;
            // Reset plate rotation and position
            infoPlate.style.width = '90vw';
            infoPlate.style.height = '80vh';
            const randomRotation2 = Math.random() * 20 - 10;
            infoPlate.style.transform = `translate(-50%, -50%) rotate(${randomRotation2}deg)`;

            // Reset logo position and style 
            logo1.classList.add('move-logo');
            logo.style.fill = 'var(--green)';
            logo1.style.width = '15vw';

            // Hide text content
            text.style.display = 'none';
            text.style.visibility = 'hidden';
            text.style.opacity = '0';

            // Show navigation elements
            navs.forEach(nav => {
                nav.style.opacity = '1';
            });

            const images = infoPlate.querySelectorAll('img, iframe, video');
            setTimeout(() => {
                images.forEach(img => {
                    img.style.opacity = '1';
                    // Counter-rotate images to keep them straight
                    img.style.transform = `rotate(${-randomRotation2}deg)`;
                });
            }, 1000);
        }

    });

});


