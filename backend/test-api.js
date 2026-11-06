/**
 * Automated acceptance checks for TC01–TC07
 */
const http = require("http");

const PORT = process.env.PORT || 3000;
const BASE = `http://127.0.0.1:${PORT}`;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(path, BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let json;
          try {
            json = JSON.parse(raw);
          } catch {
            json = { raw };
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  const results = [];
  const pass = (id, name, ok, detail) => {
    results.push({ id, name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name} — ${detail}`);
  };

  // TC01 Admin login
  {
    const r = await request("POST", "/api/login", { username: "admin", password: "admin123" });
    pass("TC01", "Admin login", r.json.success === true && /login successful/i.test(r.json.message || ""), r.json.message);
  }

  // TC02 Add a new book
  let newBookId;
  {
    const r = await request("POST", "/api/books", {
      title: "Test Driven Development",
      author: "Kent Beck",
      category: "Programming",
      quantity: 2,
    });
    newBookId = r.json.book_id;
    pass("TC02", "Add a new book", r.json.success === true && /book added/i.test(r.json.message || ""), r.json.message);
  }

  // TC03 Search for a book
  {
    const r = await request("GET", "/api/search?q=Alchemist");
    pass(
      "TC03",
      "Search for a book",
      r.json.success === true && Array.isArray(r.json.books) && r.json.books.length > 0,
      r.json.message || `${(r.json.books || []).length} result(s)`
    );
  }

  // TC04 Update book details
  {
    const r = await request("PUT", `/api/books/${newBookId}`, {
      title: "Test Driven Development (Updated)",
      author: "Kent Beck",
      category: "Programming",
      quantity: 3,
    });
    pass("TC04", "Update book details", r.json.success === true && /details updated/i.test(r.json.message || ""), r.json.message);
  }

  // Need a student
  let studentId;
  {
    const list = await request("GET", "/api/students");
    studentId = list.json.students && list.json.students[0] && list.json.students[0].student_id;
    if (!studentId) {
      const created = await request("POST", "/api/students", {
        name: "Test Student",
        email: `test${Date.now()}@example.com`,
        phone: "9999999999",
      });
      studentId = created.json.student_id;
    }
  }

  // TC05 Issue a book
  let issueId;
  {
    const due = new Date();
    due.setDate(due.getDate() + 7);
    const r = await request("POST", "/api/issues", {
      book_id: newBookId,
      student_id: studentId,
      due_date: due.toISOString().slice(0, 10),
    });
    issueId = r.json.issue_id;
    pass("TC05", "Issue a book", r.json.success === true && /book issued/i.test(r.json.message || ""), r.json.message);
  }

  // TC06 Return a book
  {
    const r = await request("POST", "/api/returns", { issue_id: issueId });
    pass("TC06", "Return a book", r.json.success === true && /book returned/i.test(r.json.message || ""), r.json.message);
  }

  // TC07 Search unavailable book
  {
    const r = await request("GET", "/api/search?q=ThisBookDoesNotExistXYZ123");
    pass(
      "TC07",
      "Search unavailable book",
      r.json.success === true &&
        Array.isArray(r.json.books) &&
        r.json.books.length === 0 &&
        /unavailable|does not exist|no matching/i.test(r.json.message || ""),
      r.json.message
    );
  }

  const failed = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error("Test runner error:", err.message);
  console.error("Make sure the server is running: npm start");
  process.exit(1);
});
