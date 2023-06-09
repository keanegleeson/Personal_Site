const petalsContainer = document.querySelector('.petals-container');
const prevButton = document.querySelector('.prev-btn');
const nextButton = document.querySelector('.next-btn');

const totalPetals = 24; // Total number of petals
const petalsPerPage = 12; // Number of petals per page
let currentPage = 1; // Current page

// Calculate the total number of pages
const totalPages = Math.ceil(totalPetals / petalsPerPage);

// Display the petals based on the current page
function displayPetals() {
  const start = (currentPage - 1)
}
