(() => {
  "use strict";

  const state = { config: null, visitorLocation: null, history: [], sending: false };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function textAll(selector, value) { $$(selector).forEach((element) => { element.textContent = value; }); }
  function encode(value) { return encodeURIComponent(value); }
  function formatPhoneHref(phone) { return `tel:${phone.replace(/[^+\d]/g, "")}`; }
  function mapsUrl(origin) {
    const { latitude, longitude } = state.config.business.coordinates;
    const destination = `${latitude},${longitude}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encode(destination)}${origin ? `&origin=${encode(origin)}` : ""}`;
  }
  function haversineKm(lat1, lon1, lat2, lon2) {
    const radians = (degrees) => degrees * Math.PI / 180;
    const earthRadiusKm = 6371;
    const a = Math.sin(radians(lat2 - lat1) / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lon2 - lon1) / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function addMessage(text, type) {
    const message = document.createElement("div");
    message.className = `message ${type}-message`;
    message.textContent = text;
    $("#messages").append(message);
    $("#messages").scrollTop = $("#messages").scrollHeight;
  }
  function chatSessionId() {
    let id = sessionStorage.getItem("business-demo-chat-session");
    if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; sessionStorage.setItem("business-demo-chat-session", id); }
    return id;
  }
  function setBookingInterface() {
    const business = state.config.business;
    const live = $("#booking-live");
    const fallback = $("#reservation-form");
    if (business.googleBookingUrl && /^https:\/\//i.test(business.googleBookingUrl)) {
      $$(".external-booking").forEach((link) => { link.href = business.googleBookingUrl; });
      live.hidden = false; fallback.hidden = true;
      $("#booking-description").textContent = "The calendar below is owned and managed by the business. It shows current availability directly; this website does not guess at open times.";
    } else {
      live.hidden = true; fallback.hidden = false;
      $("#booking-description").textContent = "A live booking calendar has not been configured for this demo. Send a reservation request and the business can confirm availability directly.";
    }
  }
  function applyConfig(config) {
    state.config = config;
    const business = config.business;
    document.title = `${business.name} | Business Demo`;
    textAll("[data-business-name]", business.name);
    textAll("[data-business-description]", business.description);
    textAll("[data-business-address]", business.address);
    textAll("[data-business-city]", "San Pedro, Laguna");
    $$("[data-business-email]").forEach((element) => { element.textContent = business.email; element.href = `mailto:${business.email}`; });
    $$("[data-business-phone]").forEach((element) => { element.textContent = business.phone; element.href = formatPhoneHref(business.phone); });
    $("#services-list").replaceChildren(...business.services.map((service, index) => {
      const card = document.createElement("article"); card.className = "service-card reveal";
      card.innerHTML = `<p class="number">0${index + 1}</p><h3></h3><p></p><strong></strong>`;
      $("h3", card).textContent = service.name; $("p:not(.number)", card).textContent = service.description; $("strong", card).textContent = service.price;
      return card;
    }));
    $("#hours-list").replaceChildren(...business.hours.map((entry) => {
      const row = document.createElement("div"); const days = document.createElement("dt"); const hours = document.createElement("dd");
      days.textContent = entry.days; hours.textContent = entry.hours; row.append(days, hours); return row;
    }));
    const { latitude, longitude } = business.coordinates;
    $("#maps-link").href = mapsUrl();
    $("#map-text-link").href = `https://www.google.com/maps/search/?api=1&query=${encode(`${latitude},${longitude}`)}`;
    $("#waze-link").href = `https://waze.com/ul?ll=${encode(`${latitude},${longitude}`)}&navigate=yes&utm_source=business-demo`;
    setBookingInterface();
  }
  function setupLocation() {
    $("#location-button").addEventListener("click", () => {
      const status = $("#location-status");
      if (!navigator.geolocation) { status.textContent = "Location is not supported by this browser. You can still open directions."; return; }
      status.textContent = "Requesting location permission…";
      $("#location-button").disabled = true;
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        state.visitorLocation = { latitude, longitude };
        const destination = state.config.business.coordinates;
        const distance = haversineKm(latitude, longitude, destination.latitude, destination.longitude);
        status.textContent = `Approximate distance: ${distance.toFixed(1)} km (straight-line distance).`;
        $("#maps-link").href = mapsUrl(`${latitude},${longitude}`);
        $("#location-button").disabled = false;
      }, (error) => {
        const messages = { 1: "Location permission was denied. Permission is required to calculate your approximate distance.", 2: "Your location is unavailable right now. You can still open directions.", 3: "Location request timed out. Please try again or open directions." };
        status.textContent = messages[error.code] || "We could not get your location. You can still open directions.";
        $("#location-button").disabled = false;
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
    });
  }
  function setupReservation() {
    const form = $("#reservation-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = $(".form-status", form); const submit = $("button[type=submit]", form);
      status.textContent = "Sending your reservation request…"; submit.disabled = true;
      try {
        const response = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(new FormData(form)).toString() });
        if (!response.ok) throw new Error("Submission failed");
        form.reset(); status.textContent = "Request sent. This is not a confirmed reservation; the business will confirm availability.";
      } catch (_) { status.textContent = "We could not send the request. Please try again or contact the business directly."; }
      submit.disabled = false;
    });
    if (new URLSearchParams(window.location.search).get("reservation") === "success") $(".form-status", form).textContent = "Request received. This is not a confirmed reservation; the business will confirm availability.";
  }
  function setupChat() {
    const form = $("#chat-form"), input = $("#chat-input"), status = $("#chat-status"), clear = $("#clear-chat");
    async function send(message) {
      const clean = message.trim(); if (!clean || state.sending) return;
      state.sending = true; addMessage(clean, "user"); input.value = ""; status.textContent = "Thinking…";
      const submit = $("button[type=submit]", form); submit.disabled = true;
      try {
        const response = await fetch("/.netlify/functions/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: clean, history: state.history, sessionId: chatSessionId() }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || typeof payload.reply !== "string") throw new Error("Chat request failed");
        addMessage(payload.reply, "assistant");
        state.history.push({ role: "user", content: clean }, { role: "assistant", content: payload.reply });
        state.history = state.history.slice(-8);
      } catch (_) { addMessage("I’m unable to respond right now. Please try again shortly or contact the business directly.", "assistant"); }
      status.textContent = ""; submit.disabled = false; state.sending = false; input.focus();
    }
    form.addEventListener("submit", (event) => { event.preventDefault(); send(input.value); });
    $$(".prompt-list button").forEach((button) => button.addEventListener("click", () => send(button.textContent)));
    clear.addEventListener("click", () => { state.history = []; $("#messages").replaceChildren(); addMessage("Chat cleared. Ask about this demo business’s services, reservations, location, hours, or contact details.", "assistant"); });
  }
  function setupMenu() { const button = $(".menu-toggle"), links = $(".nav-links"); button.addEventListener("click", () => { const open = links.classList.toggle("open"); button.setAttribute("aria-expanded", String(open)); }); $$("a", links).forEach((link) => link.addEventListener("click", () => { links.classList.remove("open"); button.setAttribute("aria-expanded", "false"); })); }
  async function start() {
    setupMenu();
    try { const response = await fetch("business-config.json", { cache: "no-store" }); if (!response.ok) throw new Error("Config unavailable"); applyConfig(await response.json()); setupLocation(); setupReservation(); setupChat(); }
    catch (_) { document.body.insertAdjacentHTML("afterbegin", '<p class="config-error" role="alert">Business information could not be loaded. Please refresh or contact the business directly.</p>'); }
  }
  document.addEventListener("DOMContentLoaded", start);
})();
