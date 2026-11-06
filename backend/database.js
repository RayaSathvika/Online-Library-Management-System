
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Database location
const dbPath = path.join(
    __dirname,
    "../database/library.db"
);

// Create or connect to database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("Connected to Library Database successfully.");
    }
});

// Enable foreign key support
db.run("PRAGMA foreign_keys = ON");

// Create database tables
db.serialize(() => {

    // Admin table
    db.run(`
        CREATE TABLE IF NOT EXISTS admins (
            admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )
    `);

    // Books table
    db.run(`
        CREATE TABLE IF NOT EXISTS books (
            book_id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            category TEXT NOT NULL,
            quantity INTEGER NOT NULL CHECK(quantity >= 0),
            available_quantity INTEGER NOT NULL
                CHECK(available_quantity >= 0)
        )
    `);

    // Students table
    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            student_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone TEXT NOT NULL
        )
    `);

    // Issued books table
    db.run(`
        CREATE TABLE IF NOT EXISTS issued_books (
            issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            issue_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            return_date TEXT,
            fine REAL DEFAULT 0,
            status TEXT DEFAULT 'Issued',
            FOREIGN KEY(book_id) REFERENCES books(book_id),
            FOREIGN KEY(student_id) REFERENCES students(student_id)
        )
    `);

    // Insert default admin account
    db.run(
        `INSERT OR IGNORE INTO admins
         (username, password)
         VALUES (?, ?)`,
        ["admin", "admin123"]
    );

    // Insert sample books
    db.run(
        `INSERT OR IGNORE INTO books
         (book_id, title, author, category, quantity, available_quantity)
         VALUES
         (1, 'The Alchemist', 'Paulo Coelho', 'Fiction', 5, 5),
         (2, 'Wings of Fire', 'A.P.J. Abdul Kalam', 'Biography', 4, 4),
         (3, 'Clean Code', 'Robert C. Martin', 'Programming', 3, 3),
         (4, 'Atomic Habits', 'James Clear', 'Self Help', 5, 5),
         (5, 'Introduction to Algorithms', 'Thomas H. Cormen', 'Programming', 2, 2)`
    );

    // Insert sample student
    db.run(
        `INSERT OR IGNORE INTO students
         (name, email, phone)
         VALUES (?, ?, ?)`,
        ["Riya Sharma", "riya@gmail.com", "9876543210"]
    );

});

module.exports = db;
