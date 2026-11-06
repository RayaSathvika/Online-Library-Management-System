function renderNav(active) {
  const links = [
    { href: "home.html", id: "home", label: "Home" },
    { href: "books.html", id: "books", label: "Manage Books" },
    { href: "search.html", id: "search", label: "Search" },
    { href: "students.html", id: "students", label: "Students" },
    { href: "issue.html", id: "issue", label: "Issue" },
    { href: "return.html", id: "return", label: "Return" },
    { href: "fines.html", id: "fines", label: "Fines" },
  ];
  const nav = document.getElementById("main-nav");
  if (!nav) return;
  nav.innerHTML = links
    .map(
      (l) =>
        `<a href="${l.href}" class="${l.id === active ? "active" : ""}">${l.label}</a>`
    )
    .join("") +
    `<a href="#" onclick="logout(); return false;">Logout</a>`;
}
