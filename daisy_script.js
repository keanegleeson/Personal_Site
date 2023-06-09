const petals = document.querySelectorAll('.petal');

petals.forEach((petal, index) => {
  const angle = index * (360 / petals.length);
  petal.style.transform = `rotate(${angle}deg) translateX(100px) rotate(-${angle}deg)`;
});
