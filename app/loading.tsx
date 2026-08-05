export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-white">

      <div className="text-center">

        <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />

        <h2 className="mt-6 text-2xl font-bold">

          Loading...

        </h2>

      </div>

    </div>
  );
}