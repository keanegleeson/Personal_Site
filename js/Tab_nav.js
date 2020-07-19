function openTab(tabName) {
    var i;
    var x = document.getElementsByClassName("nav-item");
    for (i = 0; i < x.length; i++) {
      x[i].style.display = "none";
    }
    document.getElementById(tabName).style.display = "block";
  }

  