import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center">

      <h1 className="text-8xl font-bold text-green-600">

        404

      </h1>

      <h2 className="mt-4 text-3xl font-bold">

        Page Not Found

      </h2>

      <p className="mt-4 text-gray-500">

        The page you are looking for doesn't exist.

      </p>

      <Link
        href="/"
        className="mt-8 rounded-xl bg-green-600 px-8 py-4 text-white"
      >
        Go Home
      </Link>

    </div>
  );
}