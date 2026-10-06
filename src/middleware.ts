import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/** NextAuth middleware: protect routes and restrict /admin to ADMIN role. */
export default withAuth(
  function middleware(req) {
    if (
      req.nextUrl.pathname.startsWith("/admin") &&
      req.nextauth.token?.role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
);

/** Route matcher for protected pages. */
export const config = {
  matcher: ["/", "/dashboard/:path*", "/settings/:path*", "/store/:path*", "/stats/:path*", "/admin/:path*"],
};
