const openRouteServiceApiKey = '5b3ce3597851110001cf62483560f884907b4923be76f2578ce63ac4';
const mapboxApiKey = 'sk.eyJ1IjoibXJ1ZHVsYTAyOSIsImEiOiJjbHl3cG5oMzIwdmltMmpzYmloZmhrdXRkIn0.30WpGD8FVuJj7bcNgiZiMg';

// Existing JavaScript code...

function runPythonScript() {
    fetch('/run-script', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert('Python script started successfully!');
        } else {
            alert('Failed to start Python script: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

// Existing JavaScript code...


let map;
let userLocation;
let routeLayer;
let startPoint;
let endPoint;
let selectedMode = 'walking'; // Default mode to walking
let favorites = {};
let startMarker;
let endMarker;
let directions;

function initMap() {
    map = L.map('map').setView([0, 0], 13); // Default center and zoom

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    locateUser();

    mapboxgl.accessToken = mapboxApiKey;
    map.on('load', function() {
        directions = new MapboxDirections({
            accessToken: mapboxApiKey,
            unit: 'metric',
            profile: selectedMode === 'walking' ? 'mapbox/walking' : selectedMode === 'cycling' ? 'mapbox/cycling' : 'mapbox/driving'
        });

        map.addControl(directions, 'top-left');

        directions.on('route', (event) => {
            const route = event.route[0];
            const distance = route.distance / 1000; // in kilometers
            const duration = route.duration / 60; // in minutes
            document.getElementById('time-estimates').innerHTML = `
                <div><strong>${selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)}:</strong> ${Math.round(distance)} km / ${Math.round(duration)} min</div>
            `;
        });

        directions.on('routev2', (event) => {
            const { directions: routeDirections } = event;
            if (routeDirections) {
                document.getElementById('instructions').innerHTML = '';
                routeDirections.forEach((step, index) => {
                    const instruction = step.maneuver.instruction;
                    document.getElementById('instructions').innerHTML += `<div>${index + 1}. ${instruction}</div>`;
                });
            }
        });

        if (startPoint && endPoint) {
            directions.setOrigin(startPoint);
            directions.setDestination(endPoint);
        }
    });
}

function locateUser() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            userLocation = [position.coords.latitude, position.coords.longitude];
            startPoint = userLocation;

            map.setView(userLocation, 14);

            L.marker(userLocation, {
                icon: L.divIcon({
                    className: 'glowing-circle',
                    iconSize: [24, 24]
                })
            }).addTo(map)
                .bindPopup('You are here!')
                .openPopup();

            L.circle(userLocation, { radius: 200 }).addTo(map);

            startTracking();
        }, (error) => {
            console.error('Error getting location: ', error);
            alert('Unable to retrieve your location.');
        });
    } else {
        console.error('Geolocation is not supported by this browser.');
        alert('Geolocation is not supported by this browser.');
    }
}

function startTracking() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition((position) => {
            userLocation = [position.coords.latitude, position.coords.longitude];
            updateMarker('start');

            if (directions) {
                if (startPoint && endPoint) {
                    calculateRoute();
                }
            }
        }, (error) => {
            console.error('Error tracking location: ', error);
        }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 });
    } else {
        console.error('Geolocation is not supported by this browser.');
    }
}

function fetchNearbySuggestions(query, type) {
    if (!userLocation) {
        alert('Current location not available.');
        return;
    }

    const [lat, lon] = userLocation;
    const radius = 1000; // Search within 1 km radius

    const encodedQuery = encodeURIComponent(query);

    const favoritesMatches = Object.entries(favorites).filter(([name, location]) =>
        name.toLowerCase().includes(query.toLowerCase())
    );

    if (favoritesMatches.length > 0) {
        const suggestions = type === 'start' ? document.getElementById('start-suggestions') : document.getElementById('destination-suggestions');
        suggestions.innerHTML = '';

        favoritesMatches.forEach(([name, location]) => {
            const div = document.createElement('div');
            div.textContent = name;
            div.onclick = () => {
                if (type === 'start') {
                    document.getElementById('start').value = name;
                    startPoint = location;
                    updateMarker('start');
                } else {
                    document.getElementById('destination').value = name;
                    endPoint = location;
                    updateMarker('destination');
                }
                suggestions.innerHTML = '';
                calculateRoute(); 
                autoNavigate(); // Automatically navigate
            };
            suggestions.appendChild(div);
        });

        return; 
    }

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&lat=${lat}&lon=${lon}&radius=${radius}&countrycodes=IN&limit=5`)
        .then(response => response.json())
        .then(data => {
            const suggestions = type === 'start' ? document.getElementById('start-suggestions') : document.getElementById('destination-suggestions');
            suggestions.innerHTML = '';

            data.forEach(item => {
                const div = document.createElement('div');
                div.textContent = item.display_name;
                div.onclick = () => {
                    if (type === 'start') {
                        document.getElementById('start').value = item.display_name;
                        startPoint = [item.lat, item.lon];
                        updateMarker('start');
                    } else {
                        document.getElementById('destination').value = item.display_name;
                        endPoint = [item.lat, item.lon];
                        updateMarker('destination');
                    }
                    suggestions.innerHTML = '';
                    calculateRoute(); 
                    autoNavigate(); // Automatically navigate
                };
                suggestions.appendChild(div);
            });
        }).catch(error => console.error('Error fetching nearby suggestions:', error));
}

function fetchStartSuggestions() {
    const query = document.getElementById('start').value;
    if (!query) {
        document.getElementById('start-suggestions').innerHTML = '';
        removeMarker('start');
        return;
    }
    fetchNearbySuggestions(query, 'start');
}

function fetchDestinationSuggestions() {
    const query = document.getElementById('destination').value;
    if (!query) {
        document.getElementById('destination-suggestions').innerHTML = '';
        removeMarker('destination');
        return;
    }
    fetchNearbySuggestions(query, 'destination');
}

function updateMarker(type) {
    const [lat, lon] = type === 'start' ? startPoint : endPoint;

    if (type === 'start') {
        if (startMarker) {
            startMarker.setLatLng([lat, lon]);
        } else {
            startMarker = L.marker([lat, lon], { icon: L.divIcon({ className: 'glowing-circle', iconSize: [24, 24] }) }).addTo(map);
        }
    } else {
        if (endMarker) {
            endMarker.setLatLng([lat, lon]);
        } else {
            endMarker = L.marker([lat, lon], { icon: L.divIcon({ className: 'glowing-circle', iconSize: [24, 24] }) }).addTo(map);
        }
    }

    if (directions) {
        if (startPoint && endPoint) {
            calculateRoute();
        }
    }
}

function removeMarker(type) {
    if (type === 'start' && startMarker) {
        map.removeLayer(startMarker);
        startMarker = null;
    } else if (type === 'destination' && endMarker) {
        map.removeLayer(endMarker);
        endMarker = null;
    }
}

function calculateRoute() {
    if (directions) {
        directions.setOrigin(startPoint);
        directions.setDestination(endPoint);
    }
}

function setCurrentLocation(type) {
    if (!userLocation) {
        alert('Current location not available.');
        return;
    }

    if (type === 'start') {
        startPoint = userLocation;
        document.getElementById('start').value = 'Current Location';
        updateMarker('start');
    } else {
        endPoint = userLocation;
        document.getElementById('destination').value = 'Current Location';
        updateMarker('destination');
    }

    calculateRoute(); 
    autoNavigate(); // Automatically navigate
}

function startNavigation() {
    if (startPoint && endPoint) {
        calculateRoute();
        autoNavigate(); // Automatically navigate
    } else {
        alert('Please set both start and destination points.');
    }
}

function saveFavorite() {
    const name = document.getElementById('favorite-name').value;
    if (name && (startPoint || endPoint)) {
        favorites[name] = startPoint || endPoint;
        localStorage.setItem('favorites', JSON.stringify(favorites));
        updateFavoritesList();
    } else {
        alert('Please provide a name and set a location.');
    }
}

function updateFavoritesList() {
    const list = document.getElementById('favorites-list');
    list.innerHTML = '';
    for (const [name, location] of Object.entries(favorites)) {
        const li = document.createElement('li');
        li.textContent = name;
        list.appendChild(li);
    }
}

function autoNavigate() {
    if (startPoint && endPoint) {
        calculateRoute();
        const directionsPanel = document.getElementById('instructions');
        directionsPanel.innerHTML = '';
        directions.on('route', (event) => {
            const route = event.route[0];
            const instructions = route.legs[0].steps.map(step => step.maneuver.instruction);
            instructions.forEach((instruction, index) => {
                directionsPanel.innerHTML += `<div>${index + 1}. ${instruction}</div>`;
            });
        });
    }
}

window.onload = function() {
    initMap();
    const storedFavorites = JSON.parse(localStorage.getItem('favorites'));
    if (storedFavorites) {
        favorites = storedFavorites;
        updateFavoritesList();
    }
};
