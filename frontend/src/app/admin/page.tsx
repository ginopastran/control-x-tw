import { getTokenPayload } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import AuthorizedEmailsManager from "@/components/admin/AuthorizedEmailsManager";
import {
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Button,
  Divider,
  Link,
} from "@heroui/react";

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
      <Card className="mb-8">
        <CardHeader>
          <h1 className="text-2xl font-bold">Panel de Administración</h1>
        </CardHeader>
        <Divider />
        {userData && (
          <CardBody>
            <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
              <p className="text-blue-800 dark:text-blue-300">
                Bienvenido,{" "}
                <span className="font-semibold">{userData.name}</span>
                <span className="ml-2 px-2 py-1 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                  {userData.role}
                </span>
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                {userData.email}
              </p>
            </div>
          </CardBody>
        )}
      </Card>

      {/* Sección SUPERADMIN - Gestión de correos autorizados */}
      {userData?.role === "SUPERADMIN" && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-red-600 dark:text-red-400">
                Panel SUPERADMIN
              </h2>
            </div>
          </CardHeader>
          <Divider />
          <CardBody>
            <AuthorizedEmailsManager />
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-3">
          <CardBody className="flex flex-row items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
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
              <p className="text-sm text-default-500">Cuentas de X</p>
              <h3 className="text-xl font-bold">Gestionar</h3>
            </div>
          </CardBody>
          <CardFooter>
            <Button
              as={Link}
              href="/accounts"
              color="primary"
              variant="flat"
              className="w-full"
              endContent={<span>→</span>}
            >
              Ir a cuentas
            </Button>
          </CardFooter>
        </Card>

        <Card className="p-3">
          <CardBody className="flex flex-row items-center gap-4">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
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
              <p className="text-sm text-default-500">Tweets</p>
              <h3 className="text-xl font-bold">Publicar</h3>
            </div>
          </CardBody>
          <CardFooter>
            <Button
              as={Link}
              href="/tweets"
              color="success"
              variant="flat"
              className="w-full"
              endContent={<span>→</span>}
            >
              Ir a tweets
            </Button>
          </CardFooter>
        </Card>

        <Card className="p-3">
          <CardBody className="flex flex-row  items-center gap-4">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
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
              <p className="text-sm text-default-500">Programador</p>
              <h3 className="text-xl font-bold">Acciones</h3>
            </div>
          </CardBody>
          <CardFooter>
            <Button
              as={Link}
              href="/scheduler"
              color="secondary"
              variant="flat"
              className="w-full"
              endContent={<span>→</span>}
            >
              Ir al programador
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
