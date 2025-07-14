// scripts/index.js
// Lógica de navegación y animaciones para index.html Blade Corporation
// Extraído del script inline original para cumplir CSP

// Navegación por secciones
var verificadorMBHText = document.getElementById("verificadorMBHText");
if (verificadorMBHText) {
  verificadorMBHText.addEventListener("click", function () {
    var anchor = document.querySelector("[data-scroll-to='hero']");
    if (anchor) {
      anchor.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  });
}

var serviciosText = document.getElementById("serviciosText");
if (serviciosText) {
  serviciosText.addEventListener("click", function () {
    var anchor = document.querySelector(
      "[data-scroll-to='sectionServiciosContainer']"
    );
    if (anchor) {
      anchor.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  });
}

var planesText = document.getElementById("planesText");
if (planesText) {
  planesText.addEventListener("click", function () {
    var anchor = document.querySelector(
      "[data-scroll-to='sectionPlanesContainer']"
    );
    if (anchor) {
      anchor.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  });
}

var fAQsText = document.getElementById("fAQsText");
if (fAQsText) {
  fAQsText.addEventListener("click", function () {
    var anchor = document.querySelector(
      "[data-scroll-to='sectionFAQsContainer']"
    );
    if (anchor) {
      anchor.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  });
}

var botom1 = document.getElementById("botom1");
if (botom1) {
  botom1.addEventListener("click", function () {
    var anchor = document.querySelector(
      "[data-scroll-to='sectionFormContainer']"
    );
    if (anchor) {
      anchor.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  });
}

var titleContainer = document.getElementById("titleContainer");
if (titleContainer) {
  titleContainer.addEventListener("click", function () {
    var anchor = document.querySelector(
      "[data-scroll-to='sectionPlanesContainer']"
    );
    if (anchor) {
      anchor.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  });
}

var textLinkListItem1 = document.getElementById("textLinkListItem1");
if (textLinkListItem1) {
  textLinkListItem1.addEventListener("click", function () {
    var anchor = document.querySelector(
      "[data-scroll-to='sectionFormContainer']"
    );
    if (anchor) {
      anchor.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  });
}

// Animación on-scroll (igual que original)
var scrollAnimElements = document.querySelectorAll("[data-animate-on-scroll]");
var observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting || entry.intersectionRatio > 0) {
        const targetElement = entry.target;
        targetElement.classList.add("animate");
        observer.unobserve(targetElement);
      }
    }
  },
  {
    threshold: 0.15,
  }
);
for (let i = 0; i < scrollAnimElements.length; i++) {
  observer.observe(scrollAnimElements[i]);
}