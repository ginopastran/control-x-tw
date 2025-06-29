export async function GET() {
  return Response.json({ status: "active", pending: 0 });
}
