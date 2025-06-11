import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Progress,
  Chip,
  Button,
  Select,
  SelectItem,
  Tabs,
  Tab,
  Divider,
} from "@heroui/react";

interface ActivityData {
  accountId: string;
  username: string;
  date: string;
  actions: {
    tweets: number;
    likes: number;
    retweets: number;
    follows: number;
    unfollows: number;
  };
  performance: {
    successRate: number;
    avgResponseTime: number;
    errorsCount: number;
  };
}

interface AnalyticsProps {
  className?: string;
}

export default function ActivityAnalytics({ className = "" }: AnalyticsProps) {
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");
  const [selectedMetric, setSelectedMetric] = useState("actions");

  useEffect(() => {
    fetchActivityData();
  }, [timeRange]);

  const fetchActivityData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/analytics/activity?range=${timeRange}`
      );
      if (!response.ok) throw new Error("Error al cargar datos");
      const data = await response.json();
      setActivities(data);
    } catch (error) {
      console.error("Error al cargar actividad:", error);
      // Datos simulados para desarrollo
      generateMockData();
    } finally {
      setLoading(false);
    }
  };

  const generateMockData = () => {
    const mockData: ActivityData[] = [];
    const accounts = ["CryptoBot1", "TechNews2", "FinanceAI", "SocialMax"];
    const dates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split("T")[0];
    });

    accounts.forEach((username) => {
      dates.forEach((date, index) => {
        mockData.push({
          accountId: `${username}_id`,
          username,
          date,
          actions: {
            tweets: Math.floor(Math.random() * 50) + 10,
            likes: Math.floor(Math.random() * 200) + 50,
            retweets: Math.floor(Math.random() * 100) + 20,
            follows: Math.floor(Math.random() * 30) + 5,
            unfollows: Math.floor(Math.random() * 10) + 1,
          },
          performance: {
            successRate: 85 + Math.random() * 15,
            avgResponseTime: 200 + Math.random() * 300,
            errorsCount: Math.floor(Math.random() * 5),
          },
        });
      });
    });
    setActivities(mockData);
  };

  // Métricas agregadas
  const aggregatedMetrics = useMemo(() => {
    const totalActions = activities.reduce(
      (acc, activity) => ({
        tweets: acc.tweets + activity.actions.tweets,
        likes: acc.likes + activity.actions.likes,
        retweets: acc.retweets + activity.actions.retweets,
        follows: acc.follows + activity.actions.follows,
        unfollows: acc.unfollows + activity.actions.unfollows,
      }),
      { tweets: 0, likes: 0, retweets: 0, follows: 0, unfollows: 0 }
    );

    const avgPerformance =
      activities.length > 0
        ? {
            successRate:
              activities.reduce(
                (acc, a) => acc + a.performance.successRate,
                0
              ) / activities.length,
            avgResponseTime:
              activities.reduce(
                (acc, a) => acc + a.performance.avgResponseTime,
                0
              ) / activities.length,
            totalErrors: activities.reduce(
              (acc, a) => acc + a.performance.errorsCount,
              0
            ),
          }
        : { successRate: 0, avgResponseTime: 0, totalErrors: 0 };

    return { totalActions, avgPerformance };
  }, [activities]);

  // Datos para gráficos por día
  const dailyData = useMemo(() => {
    const dailyMap = new Map<string, any>();

    activities.forEach((activity) => {
      if (!dailyMap.has(activity.date)) {
        dailyMap.set(activity.date, {
          date: activity.date,
          tweets: 0,
          likes: 0,
          retweets: 0,
          follows: 0,
          unfollows: 0,
          accounts: new Set(),
        });
      }

      const day = dailyMap.get(activity.date)!;
      day.tweets += activity.actions.tweets;
      day.likes += activity.actions.likes;
      day.retweets += activity.actions.retweets;
      day.follows += activity.actions.follows;
      day.unfollows += activity.actions.unfollows;
      day.accounts.add(activity.username);
    });

    return Array.from(dailyMap.values())
      .map((day) => ({ ...day, accountsCount: day.accounts.size }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [activities]);

  // Top performers
  const topPerformers = useMemo(() => {
    const accountMetrics = new Map<string, any>();

    activities.forEach((activity) => {
      if (!accountMetrics.has(activity.username)) {
        accountMetrics.set(activity.username, {
          username: activity.username,
          totalActions: 0,
          successRate: 0,
          days: 0,
        });
      }

      const metrics = accountMetrics.get(activity.username)!;
      metrics.totalActions += Object.values(activity.actions).reduce(
        (a, b) => a + b,
        0
      );
      metrics.successRate += activity.performance.successRate;
      metrics.days += 1;
    });

    return Array.from(accountMetrics.values())
      .map((metrics) => ({
        ...metrics,
        avgSuccessRate: metrics.successRate / metrics.days,
        avgActionsPerDay: metrics.totalActions / metrics.days,
      }))
      .sort((a, b) => b.totalActions - a.totalActions)
      .slice(0, 5);
  }, [activities]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      month: "short",
      day: "numeric",
    });
  };

  const getMetricColor = (value: number, max: number) => {
    const percentage = (value / max) * 100;
    if (percentage >= 80) return "success";
    if (percentage >= 60) return "warning";
    return "danger";
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardBody className="flex items-center justify-center py-8">
          <div className="animate-pulse text-gray-500">
            Cargando análisis...
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Controles */}
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <h3 className="text-xl font-semibold">📊 Análisis de Actividad</h3>
          <div className="flex gap-3">
            <Select
              size="sm"
              placeholder="Rango de tiempo"
              selectedKeys={[timeRange]}
              onSelectionChange={(keys) =>
                setTimeRange(Array.from(keys)[0] as string)
              }
              className="min-w-32"
            >
              <SelectItem key="1d">Último día</SelectItem>
              <SelectItem key="7d">Última semana</SelectItem>
              <SelectItem key="30d">Último mes</SelectItem>
              <SelectItem key="90d">Últimos 3 meses</SelectItem>
            </Select>
            <Button size="sm" variant="flat" onClick={fetchActivityData}>
              🔄 Actualizar
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardBody className="text-center">
            <h3 className="text-2xl font-bold text-blue-600">
              {aggregatedMetrics.totalActions.tweets.toLocaleString()}
            </h3>
            <p className="text-sm text-gray-600">Tweets</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <h3 className="text-2xl font-bold text-red-600">
              {aggregatedMetrics.totalActions.likes.toLocaleString()}
            </h3>
            <p className="text-sm text-gray-600">Likes</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <h3 className="text-2xl font-bold text-green-600">
              {aggregatedMetrics.totalActions.retweets.toLocaleString()}
            </h3>
            <p className="text-sm text-gray-600">Retweets</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <h3 className="text-2xl font-bold text-purple-600">
              {aggregatedMetrics.totalActions.follows.toLocaleString()}
            </h3>
            <p className="text-sm text-gray-600">Follows</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <h3 className="text-2xl font-bold text-orange-600">
              {aggregatedMetrics.avgPerformance.successRate.toFixed(1)}%
            </h3>
            <p className="text-sm text-gray-600">Éxito promedio</p>
          </CardBody>
        </Card>
      </div>

      {/* Gráficos y análisis */}
      <Card>
        <CardBody>
          <Tabs
            selectedKey={selectedMetric}
            onSelectionChange={(key) => setSelectedMetric(key as string)}
            variant="bordered"
          >
            <Tab key="actions" title="📈 Acciones por Día">
              <div className="space-y-4 mt-4">
                {dailyData.map((day, index) => {
                  const maxActions = Math.max(
                    ...dailyData.map((d) => d.tweets + d.likes + d.retweets)
                  );
                  const dayTotal =
                    day.tweets +
                    day.likes +
                    day.retweets +
                    day.follows +
                    day.unfollows;

                  return (
                    <div key={day.date} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          {formatDate(day.date)}
                        </span>
                        <div className="flex items-center gap-2">
                          <Chip size="sm" variant="flat">
                            {day.accountsCount} cuentas
                          </Chip>
                          <span className="text-sm text-gray-600">
                            {dayTotal.toLocaleString()} acciones
                          </span>
                        </div>
                      </div>
                      <Progress
                        value={(dayTotal / maxActions) * 100}
                        color={getMetricColor(dayTotal, maxActions)}
                        className="w-full"
                      />
                      <div className="grid grid-cols-5 gap-2 text-xs text-gray-600">
                        <div>Tweets: {day.tweets}</div>
                        <div>Likes: {day.likes}</div>
                        <div>RTs: {day.retweets}</div>
                        <div>Follows: {day.follows}</div>
                        <div>Unfollows: {day.unfollows}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Tab>

            <Tab key="performance" title="⚡ Rendimiento">
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border">
                    <CardBody className="text-center">
                      <h4 className="text-lg font-semibold text-green-600">
                        {aggregatedMetrics.avgPerformance.successRate.toFixed(
                          1
                        )}
                        %
                      </h4>
                      <p className="text-sm text-gray-600">
                        Tasa de éxito promedio
                      </p>
                      <Progress
                        value={aggregatedMetrics.avgPerformance.successRate}
                        color="success"
                        className="mt-2"
                      />
                    </CardBody>
                  </Card>
                  <Card className="border">
                    <CardBody className="text-center">
                      <h4 className="text-lg font-semibold text-blue-600">
                        {aggregatedMetrics.avgPerformance.avgResponseTime.toFixed(
                          0
                        )}
                        ms
                      </h4>
                      <p className="text-sm text-gray-600">
                        Tiempo de respuesta
                      </p>
                      <div className="mt-2">
                        <Chip
                          size="sm"
                          color={
                            aggregatedMetrics.avgPerformance.avgResponseTime <
                            300
                              ? "success"
                              : "warning"
                          }
                        >
                          {aggregatedMetrics.avgPerformance.avgResponseTime <
                          300
                            ? "Rápido"
                            : "Moderado"}
                        </Chip>
                      </div>
                    </CardBody>
                  </Card>
                  <Card className="border">
                    <CardBody className="text-center">
                      <h4 className="text-lg font-semibold text-red-600">
                        {aggregatedMetrics.avgPerformance.totalErrors}
                      </h4>
                      <p className="text-sm text-gray-600">Errores totales</p>
                      <div className="mt-2">
                        <Chip
                          size="sm"
                          color={
                            aggregatedMetrics.avgPerformance.totalErrors < 10
                              ? "success"
                              : "danger"
                          }
                        >
                          {aggregatedMetrics.avgPerformance.totalErrors < 10
                            ? "Bajo"
                            : "Alto"}
                        </Chip>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>

            <Tab key="top" title="🏆 Top Performers">
              <div className="space-y-3 mt-4">
                {topPerformers.map((performer, index) => (
                  <Card key={performer.username} className="border">
                    <CardBody className="p-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Chip
                            size="sm"
                            color={
                              index === 0
                                ? "warning"
                                : index === 1
                                ? "default"
                                : "secondary"
                            }
                          >
                            #{index + 1}
                          </Chip>
                          <span className="font-medium">
                            @{performer.username}
                          </span>
                        </div>
                        <div className="flex gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">
                              {performer.totalActions.toLocaleString()}
                            </span>
                            <span className="text-xs block">
                              acciones totales
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">
                              {performer.avgActionsPerDay.toFixed(1)}
                            </span>
                            <span className="text-xs block">promedio/día</span>
                          </div>
                          <div>
                            <span className="font-medium">
                              {performer.avgSuccessRate.toFixed(1)}%
                            </span>
                            <span className="text-xs block">éxito</span>
                          </div>
                        </div>
                      </div>
                      <Progress
                        value={performer.avgSuccessRate}
                        color={
                          performer.avgSuccessRate >= 90
                            ? "success"
                            : performer.avgSuccessRate >= 75
                            ? "warning"
                            : "danger"
                        }
                        className="mt-2"
                      />
                    </CardBody>
                  </Card>
                ))}
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
