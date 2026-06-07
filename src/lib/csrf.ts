export function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  return document.cookie.split("; ")
    .find(row => row.startsWith("csrftoken="))
    ?.split("=")[1] || "";
}
