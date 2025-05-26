import { getTokenPayload } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

async function getUserData(userId: string) {
  await connectDB();
  const user = await User.findById(userId).select("-password");
  return user
    ? {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      }
    : null;
}

export default async function AdminPage() {
  const payload = await getTokenPayload();
  const userData = payload ? await getUserData(payload.id) : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
          Panel de Administración
        </h1>

        {userData && (
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
            <p className="text-blue-800 dark:text-blue-300">
              Bienvenido, <span className="font-semibold">{userData.name}</span>
              <span className="ml-2 px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                {userData.role}
              </span>
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              {userData.email}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 mr-4">
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Cuentas de X
              </p>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                Gestionar
              </h3>
            </div>
          </div>
          <a
            href="/accounts"
            className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
          >
            Ir a cuentas →
          </a>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 mr-4">
              <svg
                className="w-6 h-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tweets</p>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                Publicar
              </h3>
            </div>
          </div>
          <a
            href="/tweets"
            className="text-green-600 dark:text-green-400 text-sm font-medium hover:underline"
          >
            Ir a tweets →
          </a>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 mr-4">
              <svg
                className="w-6 h-6 text-purple-600 dark:text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Programador
              </p>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                Acciones
              </h3>
            </div>
          </div>
          <a
            href="/scheduler"
            className="text-purple-600 dark:text-purple-400 text-sm font-medium hover:underline"
          >
            Ir al programador →
          </a>
        </div>
      </div>
    </div>
  );
}
