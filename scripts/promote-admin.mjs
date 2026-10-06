import postgres from "postgres";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run admin:promote -- customer@example.com");
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(2);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  const users = await sql`
    update "user" set role = 'ADMIN', updated_at = now()
    where lower(email) = ${email} and deleted_at is null
    returning id, email
  `;
  if (users.length !== 1) {
    console.error("No active account matched that email. Create the account first.");
    process.exitCode = 1;
  } else {
    console.log("Administrator role assigned to " + users[0].email + ".");
  }
} finally {
  await sql.end();
}
