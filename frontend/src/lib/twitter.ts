// lib/twitter.ts
export async function postToXReal(accessToken: string, message: string) {
    const url = "https://api.twitter.com/2/tweets";
  
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: message }),
    });
  
    if (!res.ok) {
      const error = await res.json();
      throw new Error(`Error ${res.status}: ${error.title || "fallo al postear"}`);
    }
  
    return await res.json();
  }
  