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

//Takes a string date like "2024-07-06T16:00:00-07:00" for both start and end.
//All day events are in this format start":"2026-04-18","end":"2026-04-20" and need to be put in the right timezone
//Returns a pretty string like "July 12, 2025 8:30 am to 2:00 pm" and also updates
//the dom element passed in for the visibile date graphic.
function formatDate(start,end,dom) {
	if (!start && !end) {
		return 'No date'
	};

	//fix all day events
	var startHasTime = true;
	if(start.length<12) {
		startHasTime=false;
		start = start + 'T00:00:00';
	}
	var endHasTime = true;
	if(end.length<12) { 
		endHasTime = false;
		end = end + 'T00:00:00';
	}

	const now = new Date();
	const startDate = start ? new Date(start) : null;
	var endDate = end ? new Date(end) : null;

	// for all-day events, end date is coming in as the day after.
	// 2026-04-18 to 2026-04-20 means 4/18 12:00am to 4/20 12:00am. I need to subract 1 second from the end
	// This may be google Calendar specific
	if(!endHasTime) {
		//Subtract 1 second from endDate
		endDate = new Date(endDate.getTime() - 1000);
	}

	const dateOptions = { month: 'short', day: 'numeric', year: 'numeric' };
	const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

	if(startDate && endDate) {

		var isActive = false;
		var isEnded = false;
		if(endDate<=now) { //ended
			isEnded = true;
		} else { //Not ended
			if(startDate<now) isActive = true; //started, but not ended. its active
		} 
	
		updateDomDate(startDate,dom);
		const sameDay = startDate.toDateString() === endDate.toDateString();
		const dateStr = startDate.toLocaleDateString(undefined, dateOptions);
		const startTimeStr = startHasTime?startDate.toLocaleTimeString(undefined, timeOptions).toLowerCase():"";
		const endTimeStr = endHasTime?endDate.toLocaleTimeString(undefined, timeOptions).toLowerCase():"";

		const label = isActive?"<span class='text-success'>Active</span>":(isEnded?"<span class='text-danger'>Ended</span>":"");
		if(sameDay) return `${dateStr} <span class='text-nowrap'>${startTimeStr} to ${endTimeStr}</span> ${label} `;
		else return `<span class='text-nowrap'>${dateStr} ${startTimeStr}</span> to <span class='text-nowrap'>${endDate.toLocaleDateString(undefined, dateOptions)} ${endTimeStr}</span> ${label}`;
	}

	if(startDate) {
		updateDomDate(startDate,dom);
		const dateStr = startDate.toLocaleDateString(undefined, dateOptions);
		const timeStr = startHasTime?startDate.toLocaleTimeString(undefined, timeOptions).toLowerCase():"";
		return `${dateStr} <span class='text-nowrap'>${timeStr}</span>`;
	}

	if(endDate) {
		updateDomDate(endDate,dom);
		const dateStr = endDate.toLocaleDateString(undefined, dateOptions);
		const timeStr = endHasTime?endDate.toLocaleTimeString(undefined, timeOptions).toLowerCase():"";
		return `Ends ${dateStr} <span class='text-nowrap'>${timeStr}</span>`;
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
	let location = event.location_linkify || event.location || '';

	//TODO: Auto link URLS that are not already clickable links
	//TODO: Add link to the contest page

	dom.querySelector('b.title').textContent = title;
	dom.querySelector('.when').innerHTML = dates;
	if(location.length) dom.querySelector('.where').innerHTML = "Location: "+location;
	dom.querySelector('.what').innerHTML = description;
	if(description.length) dom.querySelector('.what').classList.add('filled');
}

var calendarData = [];
var currentFilter_type = ""; //for the calendar
var currentFilter_location = ""; //for the calendar
var showPastEvents = false;
var limit = 0;

// Rebuilds and draws the entire calendar of events based on the current calendarData and filters which are stored in global variables
function buildCalendar() {
	console.log(calendarData,limit);

	const now = new Date().toISOString();
	const yesterday = new Date(Date.now() - 86400000*2).toISOString();
	const template = document.getElementById('event-template');
	const outputDiv = document.getElementById('calendar');
	outputDiv.innerHTML = "";

	var i = 0;
	var show = false;
	calendarData.forEach(event => { //iterate each event
		show = true;
		if(limit && i>=limit) show=false; //reached page limit
		if(currentFilter_type.length && currentFilter_type!==event.filter) show = false; //type doesnt match filter
		if(currentFilter_location.length && currentFilter_location!==event.location_filter) show = false; //type doesnt match filter
		if(!showPastEvents && event.start<yesterday) show = false; //dont show past events
		
		if(show) {
			i++;
			const clone = template.cloneNode(true); //clone the event template from the dom
			clone.id = 'event'+i;
			clone.classList.add(event.filter);
			outputDiv.appendChild(clone);
			formatEvent(event,clone.id);
		}
	});
	if(i==0) {
		console.log("No events");
		var noEvents = document.createElement('div');
		noEvents.textContent = "No upcoming events. Please check back later.";
		outputDiv.appendChild(noEvents);
	}
}

//Builds the calendar filter for the event type selector
function buildTypeFilter() {
	const outputSelect = document.getElementById('filter_type');
	if(!outputSelect) return;

	var seen = new Set();

	calendarData.forEach(event => {
		if(!seen.has(event.filter) && event.filter) {
			seen.add(event.filter);
			var option = document.createElement('option');
			option.textContent = event.filter_title;
			option.value = event.filter;
			outputSelect.appendChild(option);
		}
	});

	//Listen to changes to the select element 
	outputSelect.addEventListener('change', function() {
		currentFilter_type = this.value;
		buildCalendar();
	});
}

//Builds the calendar filter for the location selector
function buildLocationFilter() {
	const outputSelect = document.getElementById('filter_location');
	if(!outputSelect) return;

	var seen = new Set();

	calendarData.forEach(event => {
		if(event.location_filter) {
			seen.add(event.location_filter);
		}
	});

	Array.from(seen)
		.sort((a, b) => a.localeCompare(b))
		.forEach(location => {
			var option = document.createElement('option');
			option.textContent = location;
			option.value = location;
			outputSelect.appendChild(option);
		});

	const params = new URLSearchParams(window.location.search);
	const requestedLocation = params.get('location');
	if(requestedLocation) {
		const requestedLower = requestedLocation.toLowerCase();
		const match = Array.from(outputSelect.options).find(option => typeof option.value === 'string' && option.value.toLowerCase() === requestedLower);
		if(match) {
			outputSelect.value = match.value;
			currentFilter_location = match.value;
		}
	}

	//Listen to changes to the select element 
	outputSelect.addEventListener('change', function() {
		currentFilter_location = this.value;
		buildCalendar();
	});
}

function buildHistoricalFilter() {
	var pastEvents = document.getElementById('past-events');
	if(!pastEvents) return;
	
	//Listen to changes to the past event checkbox element 
	pastEvents.addEventListener('change', function() {
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
		buildTypeFilter();
		buildLocationFilter();
		buildHistoricalFilter();
		
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
