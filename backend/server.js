const express = require("express");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const FINE_PER_DAY = 5; // currency units per overdue day

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../frontend")));

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  const ms = b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0);
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function calculateFine(dueDate, returnDate) {
  const overdue = daysBetween(dueDate, returnDate);
  return overdue > 0 ? overdue * FINE_PER_DAY : 0;
}

// ---------- Admin Login ----------
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password required" });
  }
  db.get(
    "SELECT admin_id, username FROM admins WHERE username = ? AND password = ?",
    [username, password],
    (err, row) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      if (!row) return res.status(401).json({ success: false, message: "Invalid credentials" });
      res.json({ success: true, message: "Login successful", admin: row });
    }
  );
});

// ---------- Books: list / add / update / delete ----------
app.get("/api/books", (req, res) => {
  db.all("SELECT * FROM books ORDER BY book_id", [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, books: rows });
  });
});

app.get("/api/books/:id", (req, res) => {
  db.get("SELECT * FROM books WHERE book_id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!row) return res.status(404).json({ success: false, message: "Book not found" });
    res.json({ success: true, book: row });
  });
});

app.post("/api/books", (req, res) => {
  const { title, author, category, quantity } = req.body;
  const qty = parseInt(quantity, 10);
  if (!title || !author || !category || isNaN(qty) || qty < 0) {
    return res.status(400).json({ success: false, message: "Valid title, author, category and quantity required" });
  }
  db.run(
    `INSERT INTO books (title, author, category, quantity, available_quantity)
     VALUES (?, ?, ?, ?, ?)`,
    [title.trim(), author.trim(), category.trim(), qty, qty],
    function (err) {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: "Book added", book_id: this.lastID });
    }
  );
});

app.put("/api/books/:id", (req, res) => {
  const { title, author, category, quantity } = req.body;
  const qty = parseInt(quantity, 10);
  if (!title || !author || !category || isNaN(qty) || qty < 0) {
    return res.status(400).json({ success: false, message: "Valid title, author, category and quantity required" });
  }
  db.get("SELECT * FROM books WHERE book_id = ?", [req.params.id], (err, book) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!book) return res.status(404).json({ success: false, message: "Book not found" });

    const issued = book.quantity - book.available_quantity;
    if (qty < issued) {
      return res.status(400).json({
        success: false,
        message: `Cannot set quantity below ${issued} (currently issued copies)`,
      });
    }
    const available = qty - issued;
    db.run(
      `UPDATE books SET title = ?, author = ?, category = ?, quantity = ?, available_quantity = ?
       WHERE book_id = ?`,
      [title.trim(), author.trim(), category.trim(), qty, available, req.params.id],
      function (err2) {
        if (err2) return res.status(500).json({ success: false, message: err2.message });
        res.json({ success: true, message: "Details updated" });
      }
    );
  });
});

app.delete("/api/books/:id", (req, res) => {
  db.get(
    "SELECT COUNT(*) AS cnt FROM issued_books WHERE book_id = ? AND status = 'Issued'",
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      if (row.cnt > 0) {
        return res.status(400).json({ success: false, message: "Cannot delete book with active issues" });
      }
      db.run("DELETE FROM books WHERE book_id = ?", [req.params.id], function (err2) {
        if (err2) return res.status(500).json({ success: false, message: err2.message });
        if (this.changes === 0) return res.status(404).json({ success: false, message: "Book not found" });
        res.json({ success: true, message: "Book deleted" });
      });
    }
  );
});

// ---------- Search books ----------
app.get("/api/search", (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) {
    return res.status(400).json({ success: false, message: "Search query required" });
  }
  const like = `%${q}%`;
  db.all(
    `SELECT * FROM books
     WHERE title LIKE ? OR author LIKE ? OR category LIKE ?
     ORDER BY title`,
    [like, like, like],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      if (!rows.length) {
        return res.json({
          success: true,
          books: [],
          message: "No matching book found. The book may be unavailable or does not exist.",
        });
      }
      res.json({ success: true, books: rows, message: "Matching book displayed" });
    }
  );
});

// ---------- Student registration ----------
app.get("/api/students", (req, res) => {
  db.all("SELECT * FROM students ORDER BY student_id", [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, students: rows });
  });
});

app.post("/api/students", (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ success: false, message: "Name, email and phone required" });
  }
  db.run(
    "INSERT INTO students (name, email, phone) VALUES (?, ?, ?)",
    [name.trim(), email.trim(), phone.trim()],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE")) {
          return res.status(400).json({ success: false, message: "Email already registered" });
        }
        return res.status(500).json({ success: false, message: err.message });
      }
      res.json({ success: true, message: "Student registered", student_id: this.lastID });
    }
  );
});

// ---------- Issue books ----------
app.get("/api/issues", (req, res) => {
  const status = req.query.status;
  let sql = `
    SELECT i.*, b.title, b.author, s.name AS student_name, s.email
    FROM issued_books i
    JOIN books b ON b.book_id = i.book_id
    JOIN students s ON s.student_id = i.student_id
  `;
  const params = [];
  if (status) {
    sql += " WHERE i.status = ?";
    params.push(status);
  }
  sql += " ORDER BY i.issue_id DESC";
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, issues: rows });
  });
});

app.post("/api/issues", (req, res) => {
  const { book_id, student_id, due_date } = req.body;
  if (!book_id || !student_id || !due_date) {
    return res.status(400).json({ success: false, message: "book_id, student_id and due_date required" });
  }
  db.get("SELECT * FROM books WHERE book_id = ?", [book_id], (err, book) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!book) return res.status(404).json({ success: false, message: "Book not found" });
    if (book.available_quantity <= 0) {
      return res.status(400).json({ success: false, message: "Book unavailable — no copies left" });
    }
    db.get("SELECT * FROM students WHERE student_id = ?", [student_id], (err2, student) => {
      if (err2) return res.status(500).json({ success: false, message: err2.message });
      if (!student) return res.status(404).json({ success: false, message: "Student not found" });

      const issueDate = todayISO();
      db.run(
        `INSERT INTO issued_books (book_id, student_id, issue_date, due_date, status)
         VALUES (?, ?, ?, ?, 'Issued')`,
        [book_id, student_id, issueDate, due_date],
        function (err3) {
          if (err3) return res.status(500).json({ success: false, message: err3.message });
          db.run(
            "UPDATE books SET available_quantity = available_quantity - 1 WHERE book_id = ?",
            [book_id],
            (err4) => {
              if (err4) return res.status(500).json({ success: false, message: err4.message });
              res.json({
                success: true,
                message: "Book issued",
                issue_id: this.lastID,
                issue_date: issueDate,
              });
            }
          );
        }
      );
    });
  });
});

// ---------- Return books ----------
app.post("/api/returns", (req, res) => {
  const { issue_id } = req.body;
  if (!issue_id) {
    return res.status(400).json({ success: false, message: "issue_id required" });
  }
  db.get("SELECT * FROM issued_books WHERE issue_id = ?", [issue_id], (err, issue) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!issue) return res.status(404).json({ success: false, message: "Issue record not found" });
    if (issue.status === "Returned") {
      return res.status(400).json({ success: false, message: "Book already returned" });
    }
    const returnDate = todayISO();
    const fine = calculateFine(issue.due_date, returnDate);
    db.run(
      `UPDATE issued_books
       SET return_date = ?, fine = ?, status = 'Returned'
       WHERE issue_id = ?`,
      [returnDate, fine, issue_id],
      function (err2) {
        if (err2) return res.status(500).json({ success: false, message: err2.message });
        db.run(
          "UPDATE books SET available_quantity = available_quantity + 1 WHERE book_id = ?",
          [issue.book_id],
          (err3) => {
            if (err3) return res.status(500).json({ success: false, message: err3.message });
            res.json({
              success: true,
              message: "Book returned",
              return_date: returnDate,
              fine,
            });
          }
        );
      }
    );
  });
});

// ---------- Overdue fines ----------
app.get("/api/fines", (req, res) => {
  const today = todayISO();
  db.all(
    `SELECT i.*, b.title, b.author, s.name AS student_name, s.email, s.phone,
      CASE
        WHEN i.status = 'Returned' THEN i.fine
        WHEN i.due_date < ? THEN (JULIANDAY(?) - JULIANDAY(i.due_date)) * ?
        ELSE 0
      END AS calculated_fine,
      CASE
        WHEN i.status = 'Returned' THEN 0
        WHEN i.due_date < ? THEN CAST(JULIANDAY(?) - JULIANDAY(i.due_date) AS INTEGER)
        ELSE 0
      END AS overdue_days
     FROM issued_books i
     JOIN books b ON b.book_id = i.book_id
     JOIN students s ON s.student_id = i.student_id
     WHERE (i.status = 'Returned' AND i.fine > 0)
        OR (i.status = 'Issued' AND i.due_date < ?)
     ORDER BY calculated_fine DESC`,
    [today, today, FINE_PER_DAY, today, today, today],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({
        success: true,
        fine_per_day: FINE_PER_DAY,
        fines: rows.map((r) => ({
          ...r,
          calculated_fine: Number(r.calculated_fine) || 0,
          overdue_days: Number(r.overdue_days) || 0,
        })),
      });
    }
  );
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

app.listen(PORT, () => {
  console.log(`Library Management System running at http://localhost:${PORT}`);
});
