function isWebGLSupported() {
	//To test, from terminal: open -a "Google Chrome" --args  -disable-webgl
	try {
		const canvas = document.createElement('canvas');
		return !!(window.WebGLRenderingContext && (
			canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
		);
	} catch (e) {
		return false;
	}
}

//Cloud header animation
function initializeCloudAnimation() {
	const kl = document.getElementById("klouds");
	if(kl && isWebGLSupported()) { // this one not currently used
		try {
			//https://github.com/skyrim/klouds/
			var k = klouds.create({
				selector: '#klouds',
				layerCount: 45,
				speed: 1,
				cloudColor1: '#c8dff0',
				cloudColor2: '#ffffff',
				bgColor: '#ddf0fe'
			});
		} catch (error) {
			console.error('Problem with animated clouds',error);
		}
	}
}

//given a JS Date object and a dom element for the graphical calendar item, updates it in place.
function updateDomDate(date,dateElement) {
	if(!dateElement) return;
	const month = date.toLocaleString(undefined, { month: 'short' }); // "June"
	const day = date.getDate();                            // 25
	const dayOfWeek = date.toLocaleString(undefined, { weekday: 'short' }); // "Tue"
	const year = date.getFullYear();                       // 2024

	const melement = dateElement.querySelector('.month');
	const delement = dateElement.querySelector('.day');
	const felement = dateElement.querySelector('.dayofweek');
	const yelement = dateElement.querySelector('.year');

	if(melement) melement.textContent = month;
	if(delement) delement.textContent = day;
	if(felement) felement.textContent = dayOfWeek;
	if(yelement) yelement.textContent = year;
}

//Takes a string date like "2024-07-06T16:00:00-07:00" for both start and end
//Returns a pretty string like "July 12, 2025 8:30 am to 2:00 pm" and also updates
//the dom element passed in for the visibile date graphic.
function formatDate(start,end,dom) {
	if (!start && !end) {
		return 'No date'
	};

	const startDate = start ? new Date(start) : null;
	const endDate = end ? new Date(end) : null;

	const dateOptions = { month: 'long', day: 'numeric', year: 'numeric' };
	const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

	if(startDate && endDate) {
		updateDomDate(startDate,dom);
		const sameDay = startDate.toDateString() === endDate.toDateString();
		const dateStr = startDate.toLocaleDateString(undefined, dateOptions);
		const startTimeStr = startDate.toLocaleTimeString(undefined, timeOptions).toLowerCase();
		const endTimeStr = endDate.toLocaleTimeString(undefined, timeOptions).toLowerCase();
		return sameDay
			? `${dateStr} ${startTimeStr} to ${endTimeStr}`
			: `${dateStr} ${startTimeStr} to ${endDate.toLocaleDateString(undefined, dateOptions)} ${endTimeStr}`;
	}

	if(startDate) {
		updateDomDate(startDate,dom);
		const dateStr = startDate.toLocaleDateString(undefined, dateOptions);
		const timeStr = startDate.toLocaleTimeString(undefined, timeOptions).toLowerCase();
		return `${dateStr} ${timeStr}`;
	}

	if(endDate) {
		updateDomDate(endDate,dom);
		const dateStr = endDate.toLocaleDateString(undefined, dateOptions);
		const timeStr = endDate.toLocaleTimeString(undefined, timeOptions).toLowerCase();
		return `${dateStr} ${timeStr}`;
	}

	return 'Invalid date';
}

//Given an event object and a dom ID, this will format the event and insert the data into the DOM
function formatEvent(event,id) {
	const dom = document.getElementById(id);

	const title = event.summary || 'No title';
	const start = event.start || '';
	const end = event.end || '';
	const dates = formatDate(start,end,dom);

	let description = event.description || '';
	description = description.replace(/\+\+\+[\s\S]*?\+\+\+/g, ''); //remove Discord ChronicalBot Frontmatter
	description = description.replace(/^(<br\s*\/?>\s*)+/i, ''); //Remove leading line breaks
	description = description.trim(); //trim whitespace

	//Auto link locations to the location page on the site
	let location = event.location || '';
	location = location.replace("Poway Field", '<a href="/poway-field.html">Poway Field</a>');
	location = location.replace("Torrey Pines Gliderport", '<a href="/torrey-pines-glider-port.html">Torrey Pines Gliderport</a>');
	location = location.replace("Encinitas Field", '<a href="/encinitas-field.html">Encinitas Field</a>');

	//TODO: Auto link URLS that are not already clickable links
	//TODO: Add link to the contest page

	dom.querySelector('b.title').textContent = title;
	dom.querySelector('.when').textContent = dates;
	if(location.length) dom.querySelector('.where').innerHTML = "Location: "+location;
	dom.querySelector('.what').innerHTML = description;
	if(description.length) dom.querySelector('.what').classList.add('filled');
}

var calendarData = [];
var currentFilter = ""; //for the calendar
var showPastEvents = false;
var limit = 0;

// Rebuilds and draws the entire calendar of events based on the current calendarData and filters which are stored in global variables
function buildCalendar() {
	console.log(calendarData,limit);

	const now = new Date().toISOString();
	const template = document.getElementById('event-template');
	const outputDiv = document.getElementById('calendar');
	outputDiv.innerHTML = "";

	var i = 0;
	calendarData.forEach(event => { //iterate each event
		if(!limit || i<limit) {
			if(currentFilter=="" || currentFilter==event.filter) { //check for event type filter
				if(showPastEvents || event.start>now) { //check for past events checkbox
					i++;
					const clone = template.cloneNode(true); //clone the event template from the dom
					clone.id = 'event'+i;
					clone.classList.add(event.filter);
					outputDiv.appendChild(clone);
					formatEvent(event,clone.id);
				}
			}
		}
	});
}

//Builds the calendar filter
function buildFilter() {
	const outputSelect = document.getElementById('filter');
	if(!outputSelect) return;

	var seen = new Set();

	calendarData.forEach(event => {
		if(!seen.has(event.filter)) {
			seen.add(event.filter);
			var option = document.createElement('option');
			option.textContent = event.filter_title;
			option.value = event.filter;
			outputSelect.appendChild(option);
		}
	});

	//Listen to changes to the select element 
	outputSelect.addEventListener('change', function() {
		currentFilter = this.value;
		buildCalendar();
	});

	//Listen to changes to the past event checkbox element 
	document.getElementById('past-events').addEventListener('change', function() {
		if(this.checked) showPastEvents = true;
		else showPastEvents = false;
		buildCalendar();
	});
}

function sortEvents(data) {
	if(Array.isArray(data)) {
		data.sort((a, b) => new Date(a.start) - new Date(b.start));
	}
	return data;
}

//Reads the calendar json file from the server and then builds and draws the calendar
function readCalendar() {
	const calendar = document.getElementById('calendar');
	if(!calendar) return;
	const showLimit = calendar.getAttribute('data-limit');
	if(showLimit) limit = parseInt(showLimit);

	const dataSrc = calendar.getAttribute('data-src');
	fetch(dataSrc).then(response => {
		if(!response.ok) {
			throw new Error('Network response was not ok');
		}
		return response.json();
	}).then(data => {
		calendarData = sortEvents(data);
		buildFilter();
		buildCalendar();
	}).catch(error => {
		console.error('There was a problem loading the JSON file:', error);
	});
}


//Bootup code when page is ready.
document.addEventListener("DOMContentLoaded", function() {

	initializeCloudAnimation();

	readCalendar();

});
