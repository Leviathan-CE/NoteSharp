export const getStoredAuthToken = (): string | null => {
  let token = localStorage.getItem("authToken") || "";

  if ((!token || token === "undefined" || token === "null") && localStorage.getItem("user")) {
    try {
      const parsed = JSON.parse(localStorage.getItem("user") as string);
      token =
        parsed?.token ||
        parsed?.accessToken ||
        parsed?.stsTokenManager?.accessToken ||
        parsed?.user?.accessToken ||
        "";
    } catch {
      token = "";
    }
  }

  token = (token || "").toString().trim().replace(/^"|"$/g, "");
  return token || null;
};
