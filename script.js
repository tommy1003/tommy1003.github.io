$(document).ready(async function () {
    // Sample Data
    const data = [
        {
            "id": 1020842077,
            "code": "KH000458",
            "name": "Sang hưởng 987.646051",
            "address": "Thị Trấn Giao Xuân - Giao Thủy - Nam Định",
            "retailerId": 500251720,
            "branchId": 397114,
            "locationName": "",
            "wardName": "",
            "modifiedDate": "2023-06-28T02:09:13.8670000",
            "createdDate": "2023-06-28T01:19:25.1000000",
            "type": 0,
            "debt": 0.0000,
            "totalInvoiced": 0,
            "totalRevenue": 0,
            "totalPoint": 0
        },
        {
            "id": 1020842080,
            "code": "KH000002",
            "name": "35 trần bích san 911280480",
            "address": "35 trần bích san",
            "retailerId": 500251720,
            "branchId": 397114,
            "locationName": "",
            "wardName": "",
            "modifiedDate": "2023-06-28T02:09:13.9270000",
            "createdDate": "2023-06-28T01:19:25.1000000",
            "type": 0,
            "debt": 0.0000,
            "totalInvoiced": 0,
            "totalRevenue": 0,
            "totalPoint": 0
        }
    ];

    // Initialize Map
    const map = L.map('map', {
        minZoom: 5,  // Prevent zooming out too far
        maxZoom: 18  // Standard max zoom
    }).setView([16.0474, 108.2062], 6); // Center of Vietnam with zoom level 6

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // After all markers are added, fit bounds to show all points
    map.on('routing:routesfound', function() {
        const bounds = L.latLngBounds([departureCoords]);
        validCoordinates.forEach(point => {
            bounds.extend(point.coordinates);
        });
        map.fitBounds(bounds, { padding: [50, 50] });
    });

    // Add geocoding cache with timeout
    const geocodeCache = new Map();
    const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    // Improved geocoding function with rate limiting and better error handling
    async function geocodeAddress(address, name) {
        // Check cache first and validate expiry
        if (geocodeCache.has(address)) {
            const cached = geocodeCache.get(address);
            if (Date.now() - cached.timestamp < CACHE_EXPIRY) {
                if (cached.coords[0] !== 0) {  // If it's not a failed geocoding
                    L.marker(cached.coords)
                        .addTo(map)
                        .bindPopup(`<b>${name}</b><br>${address}`);
                }
                return cached.coords;
            }
            geocodeCache.delete(address); // Remove expired cache entry
        }

        // Add delay to respect rate limits (1 request per second)
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
            const response = await $.getJSON(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=vn`
            );
            
            if (response.length > 0) {
                const { lat, lon } = response[0];
                const coords = [Number(lat), Number(lon)];
                // Cache the successful result with timestamp
                geocodeCache.set(address, { coords, timestamp: Date.now() });
                
                const marker = L.marker(coords)
                    .addTo(map)
                    .bindPopup(`<b>${name}</b><br>${address}`);
                
                return coords;
            }
        } catch (error) {
            console.warn(`Geocoding failed for: ${address}`, error);
        }
        
        // Cache the failed result with timestamp
        const failedCoords = [0, 0];
        geocodeCache.set(address, { coords: failedCoords, timestamp: Date.now() });
        return failedCoords;
    }

    // Process addresses in batches to avoid overwhelming the geocoding service
    const BATCH_SIZE = 5; // Process 5 addresses at a time

    async function processBatch(items) {
        const results = await Promise.all(
            items.map(item => geocodeAddress(item.address, item.name))
        );
        return results;
    }

    // Process all addresses in batches
    async function processAllAddresses(data) {
        const results = [];
        
        for (let i = 0; i < data.length; i += BATCH_SIZE) {
            const batch = data.slice(i, i + BATCH_SIZE);
            const batchResults = await processBatch(batch);
            results.push(...batchResults);
            
            // Optional: Add a small delay between batches
            if (i + BATCH_SIZE < data.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Update the original data with coordinates
        data.forEach((item, index) => {
            item.coordinates = results[index];
        });
        
        return data;
    }

    // Use the new function
    await processAllAddresses(data);

    console.log(data);

    // Add departure point
    const departurePoint = "43 bến ngự, nam định";
    let departureCoords = await geocodeAddress(departurePoint, "Departure Point");

    // Filter valid coordinates and create route for each destination
    const validCoordinates = data.filter(item => item.coordinates[0] !== 0 && item.coordinates[1] !== 0);

    validCoordinates.forEach(destination => {
        L.Routing.control({
            waypoints: [
                L.latLng(departureCoords[0], departureCoords[1]),
                L.latLng(destination.coordinates[0], destination.coordinates[1])
            ],
            routeWhileDragging: true,
            showAlternatives: true,
            createMarker: function(i, waypoint, n) {
                const label = i === 0 ? "Departure Point" : destination.name;
                const address = i === 0 ? departurePoint : destination.address;
                return L.marker(waypoint.latLng).bindPopup(`<b>${label}</b><br>${address}`);
            },
        }).addTo(map);
    });

    L.Routing.osrmv1({
        profile: 'car', // Options: 'car', 'bike', 'foot'
    });
});
