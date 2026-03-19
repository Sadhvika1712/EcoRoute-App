import './style.css';
import L from 'leaflet';
import { jsPDF } from 'jspdf';

// Constants for CO2 emissions (kg per km per passenger)
const EMISSION_RATES = {
  car: 0.192,
  bus: 0.089,
  bike: 0.0,
};

// Global state
let startMarker = null;
let endMarker = null;
let routingLayer = null; // A layer to hold the routing line
let currentDistanceKm = 0;
let monthlySavingsVal = 45; // Initial mock value
let userGoal = 100;

// Set up Map
const map = L.map('map', { zoomControl: false }).setView([40.7128, -74.0060], 13); // Default roughly NYC

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Move zoom control to bottom right so it doesn't overlap sidebar
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

// Custom icons
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// UI Elements
const calculateBtn = document.getElementById('calculate-btn');
const startInput = document.getElementById('start-location');
const endInput = document.getElementById('end-location');
const modeRadios = document.querySelectorAll('input[name="transport-mode"]');
const co2Result = document.getElementById('co2-result');
const emissionBadge = document.getElementById('emission-badge');
const savingsProgress = document.getElementById('savings-progress');
const monthlySavingsDisplay = document.getElementById('monthly-savings-val');

// Sustainability Panel UI Elements
const sustainabilityPanel = document.getElementById('sustainability-panel');
const carVsBusComparison = document.getElementById('car-vs-bus-comparison');
const treeSavings = document.getElementById('tree-savings');
const ecoScoreVal = document.getElementById('eco-score-val');
const ecoScoreProgress = document.getElementById('eco-score-progress');

// Helper to update visual progress
function updateProgressBar(savings) {
    const percentage = Math.min((savings / userGoal) * 100, 100);
    savingsProgress.style.width = `${percentage}%`;
    monthlySavingsDisplay.textContent = Math.round(savings);
}

// Function to fetch coordinates using Nominatim API
async function geocode(location) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
    return null;
}

// Logic to simulate routing between start and end (using actual geocoding)
async function simulateRoutingAndCalculate() {
    const startObj = startInput.value.trim();
    const endObj = endInput.value.trim();

    if (!startObj || !endObj) {
        alert("Please enter both start and destination locations.");
        return;
    }

    const previousBtnHTML = calculateBtn.innerHTML;
    calculateBtn.disabled = true;
    calculateBtn.textContent = 'Calculating...';

    try {
        const startLatLng = await geocode(startObj);
        const endLatLng = await geocode(endObj);

        if (!startLatLng || !endLatLng) {
            alert('Location not found');
            return;
        }

        // Clear previous markers and layers
        if (startMarker) map.removeLayer(startMarker);
        if (endMarker) map.removeLayer(endMarker);
        if (routingLayer) map.removeLayer(routingLayer);

        // Add new markers
        startMarker = L.marker(startLatLng, {icon: greenIcon}).addTo(map).bindPopup('Start: ' + startObj);
        endMarker = L.marker(endLatLng, {icon: redIcon}).addTo(map).bindPopup('Destination: ' + endObj);

        // Draw simple line
        routingLayer = L.polyline([startLatLng, endLatLng], {
            color: '#10b981', // Tailwind green-500
            weight: 6,
            opacity: 0.8,
            dashArray: '10, 10'
        }).addTo(map);

        // Fit bounds to smoothly move the map view
        map.fitBounds(routingLayer.getBounds(), { padding: [50, 50], animate: true, duration: 1.5 });

        // Calculate distance (straight line in km)
        const latlng1 = L.latLng(startLatLng);
        currentDistanceKm = latlng1.distanceTo(L.latLng(endLatLng)) / 1000;

        // Trigger update calculation
        recalculateEmissions();
    } catch (error) {
        console.error("Geocoding error:", error);
        alert('Location not found');
    } finally {
        calculateBtn.disabled = false;
        calculateBtn.innerHTML = previousBtnHTML;
    }
}

// Function to calculate and update UI based on distance and mode
function recalculateEmissions() {
    if (currentDistanceKm === 0) return;

    let selectedMode = 'car';
    for (const radio of modeRadios) {
        if (radio.checked) {
            selectedMode = radio.value;
            break;
        }
    }

    const rate = EMISSION_RATES[selectedMode];
    const emissions = (currentDistanceKm * rate).toFixed(2);
    
    // Update CO2 text
    co2Result.textContent = emissions;

    // Update Badge styling
    emissionBadge.classList.remove('bg-gray-200', 'text-gray-600', 'bg-red-100', 'text-red-700', 'bg-yellow-100', 'text-yellow-700', 'bg-green-100', 'text-green-700');
    
    if (selectedMode === 'car') {
        emissionBadge.textContent = 'High Impact';
        emissionBadge.classList.add('bg-red-100', 'text-red-700');
    } else if (selectedMode === 'bus') {
        emissionBadge.textContent = 'Moderate';
        emissionBadge.classList.add('bg-yellow-100', 'text-yellow-700');
    } else {
        emissionBadge.textContent = 'Eco-Friendly';
        emissionBadge.classList.add('bg-green-100', 'text-green-700');
    }

    // Simulate saving difference compared to a car
    const carEmissions = currentDistanceKm * EMISSION_RATES.car;
    const busEmissions = currentDistanceKm * EMISSION_RATES.bus;
    const bikeEmissions = currentDistanceKm * EMISSION_RATES.bike;
    const currentEmissions = currentDistanceKm * rate;
    const savingsThisTrip = carEmissions - currentEmissions;

    // Show the sustainability panel
    if (sustainabilityPanel.classList.contains('hidden')) {
        sustainabilityPanel.classList.remove('hidden');
    }

    // Comparison Logic
    const savingsIfBus = (carEmissions - busEmissions).toFixed(2);
    if (selectedMode === 'car') {
        carVsBusComparison.innerHTML = `If you took the Bus instead of a Car, you would save <span class="font-bold">${savingsIfBus}</span> kg of CO₂.`;
    } else if (selectedMode === 'bus') {
        carVsBusComparison.innerHTML = `By taking the Bus instead of a Car, you're currently saving <span class="font-bold">${savingsThisTrip.toFixed(2)}</span> kg of CO₂!`;
    } else {
        carVsBusComparison.innerHTML = `By taking a Bike instead of a Car, you're currently saving <span class="font-bold">${savingsThisTrip.toFixed(2)}</span> kg of CO₂!`;
    }

    // Tree Savings (assuming 1 mature tree absorbs ~0.06 kg of CO2 per day)
    const treeCount = savingsThisTrip > 0 ? Math.max(1, Math.ceil(savingsThisTrip / 0.06)) : 0;
    treeSavings.textContent = treeCount;

    // Eco-Score (100% is 0 emissions, 0% is car mode emissions)
    const ecoScore = carEmissions > 0 ? Math.round(100 - ((currentEmissions / carEmissions) * 100)) : 100;
    ecoScoreVal.textContent = `${ecoScore}%`;
    ecoScoreProgress.style.width = `${ecoScore}%`;

    if (savingsThisTrip > 0) {
        // Mock increasing the monthly savings logically
        // To prevent infinite inflation during clicking, we pretend this is a "preview" 
        // We'll temporarily add this trip's savings to the baseline.
        updateProgressBar(monthlySavingsVal + savingsThisTrip);
    } else {
        updateProgressBar(monthlySavingsVal);
    }
}

// Event Listeners
calculateBtn.addEventListener('click', simulateRoutingAndCalculate);

// Listen to mode changes to instantly update emissions without re-routing
modeRadios.forEach(radio => {
    radio.addEventListener('change', recalculateEmissions);
});

// Initialize progress
updateProgressBar(monthlySavingsVal);

// Download PDF Report Functionality
document.getElementById('download-report-btn').addEventListener('click', () => {
    const startStr = startInput.value.trim();
    const endStr = endInput.value.trim();
    const co2 = co2Result.textContent;
    
    if (!startStr || !endStr || currentDistanceKm === 0 || co2 === '--') {
        alert("Please calculate a route first before downloading a report.");
        return;
    }

    let selectedMode = 'car';
    for (const radio of modeRadios) {
        if (radio.checked) selectedMode = radio.value;
    }
    const capMode = selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1);

    const doc = new jsPDF();
    
    // Green header background
    doc.setFillColor(16, 185, 129); // green-500
    doc.rect(0, 0, 210, 40, 'F');
    
    // EcoRoute Logo/Title (White)
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("EcoRoute", 20, 26);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("Sustainable Navigation", 20, 33);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Trip Report", 160, 26);
    
    // Content
    doc.setTextColor(55, 65, 81); // gray-700
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Journey Summary", 20, 60);
    
    // Divider
    doc.setDrawColor(209, 213, 219); // gray-300
    doc.setLineWidth(0.5);
    doc.line(20, 65, 190, 65);
    
    // Details
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Start Location:", 20, 80);
    doc.setFont("helvetica", "normal");
    doc.text(startStr, 60, 80);
    
    doc.setFont("helvetica", "bold");
    doc.text("Destination:", 20, 95);
    doc.setFont("helvetica", "normal");
    doc.text(endStr, 60, 95);
    
    doc.setFont("helvetica", "bold");
    doc.text("Distance:", 20, 110);
    doc.setFont("helvetica", "normal");
    doc.text(`${currentDistanceKm.toFixed(2)} km`, 60, 110);
    
    doc.setFont("helvetica", "bold");
    doc.text("Transport Mode:", 20, 125);
    doc.setFont("helvetica", "normal");
    doc.text(capMode, 65, 125);

    // CO2 Box
    doc.setFillColor(243, 244, 246); // gray-100
    doc.roundedRect(20, 140, 170, 30, 3, 3, 'F');
    
    doc.setTextColor(16, 185, 129); // green-500
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Total CO2 Emissions", 30, 153);
    
    doc.setTextColor(31, 41, 55); // gray-800
    doc.setFontSize(22);
    doc.text(`${co2} kg`, 30, 163);
    
    // Footer message
    doc.setTextColor(156, 163, 175); // gray-400
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("Thank you for using EcoRoute to track your carbon footprint!", 105, 270, { align: 'center' });
    
    // Save the PDF
    doc.save("EcoRoute_Trip_Report.pdf");
});

