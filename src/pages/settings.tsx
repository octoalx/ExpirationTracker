import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { User, Bell, Palette, AlertTriangle } from "lucide-react";

const SettingsPage = () => {
  const { data: session, update: updateSession } = useSession();
  const [activeTab, setActiveTab] = useState("personal");

  const [user, setUser] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
  });

  const [settings, setSettings] = useState({
    telegramNotifications: true,
    emailNotifications: false,
    theme: "light",
    urgentThreshold: 3,
    warningThreshold: 7,
    telegramToken: "",
    telegramChatId: "",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    notificationEmail: "",
    notifyBeforeExpiration: 3,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
          setUser((prev) => ({ ...prev, ...data.user }));
        }
      });
  }, []);

  const handleSave = async () => {
    const cleanUser = {
      name: user.name,
      email: user.email,
    };
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: cleanUser, settings }),
    });
    if (res.ok) {
      alert("Настройки сохранены!");
      updateSession({ user: { ...session?.user, ...cleanUser } });
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "personal":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Личные данные</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Имя
                </label>
                <input
                  type="text"
                  value={user.name}
                  onChange={(e) => setUser({ ...user, name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  onChange={(e) => setUser({ ...user, email: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
        );
      case "integrations":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Интеграции</h2>
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Telegram</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Включить Telegram уведомления
                  </span>
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        telegramNotifications: !settings.telegramNotifications,
                      })
                    }
                    className={`${settings.telegramNotifications ? "bg-indigo-600" : "bg-gray-200"} relative inline-flex h-6 w-11 items-center rounded-full`}
                  >
                    <span
                      className={`${settings.telegramNotifications ? "translate-x-6" : "translate-x-1"} inline-block h-4 w-4 transform rounded-full bg-white transition`}
                    />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Telegram Token
                  </label>
                  <input
                    type="text"
                    value={settings.telegramToken || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        telegramToken: e.target.value,
                      })
                    }
                    className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Telegram Chat ID
                  </label>
                  <input
                    type="text"
                    value={settings.telegramChatId || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        telegramChatId: e.target.value,
                      })
                    }
                    className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Email (SMTP)</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Включить Email уведомления
                  </span>
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        emailNotifications: !settings.emailNotifications,
                      })
                    }
                    className={`${settings.emailNotifications ? "bg-indigo-600" : "bg-gray-200"} relative inline-flex h-6 w-11 items-center rounded-full`}
                  >
                    <span
                      className={`${settings.emailNotifications ? "translate-x-6" : "translate-x-1"} inline-block h-4 w-4 transform rounded-full bg-white transition`}
                    />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={settings.smtpHost || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, smtpHost: e.target.value })
                    }
                    className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    value={settings.smtpPort || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        smtpPort: parseInt(e.target.value),
                      })
                    }
                    className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    SMTP User
                  </label>
                  <input
                    type="text"
                    value={settings.smtpUser || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, smtpUser: e.target.value })
                    }
                    className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    SMTP Password
                  </label>
                  <input
                    type="password"
                    value={settings.smtpPass || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, smtpPass: e.target.value })
                    }
                    className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email для уведомлений
                  </label>
                  <input
                    type="email"
                    value={settings.notificationEmail || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notificationEmail: e.target.value,
                      })
                    }
                    className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      case "statuses":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Статусы</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  "Срочно" (дней до)
                </label>
                <input
                  type="number"
                  value={settings.urgentThreshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      urgentThreshold: parseInt(e.target.value),
                    })
                  }
                  className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  "Внимание" (дней до)
                </label>
                <input
                  type="number"
                  value={settings.warningThreshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      warningThreshold: parseInt(e.target.value),
                    })
                  }
                  className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
          </div>
        );
      case "appearance":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Оформление</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Тема
              </label>
              <select
                value={settings.theme}
                onChange={(e) =>
                  setSettings({ ...settings, theme: e.target.value })
                }
                className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="light">Светлая</option>
                <option value="dark">Темная</option>
              </select>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Настройки</h1>
      <div className="flex space-x-8">
        {/* Sidebar */}
        <div className="w-1/4">
          <ul className="space-y-2">
            <li>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab("personal");
                }}
                className={`flex items-center space-x-3 p-2 rounded-md ${activeTab === "personal" ? "bg-slate-200" : ""}`}
              >
                <User size={20} />
                <span>Личные данные</span>
              </a>
            </li>
            <li>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab("integrations");
                }}
                className={`flex items-center space-x-3 p-2 rounded-md ${activeTab === "integrations" ? "bg-slate-200" : ""}`}
              >
                <Bell size={20} />
                <span>Интеграции</span>
              </a>
            </li>
            <li>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab("statuses");
                }}
                className={`flex items-center space-x-3 p-2 rounded-md ${activeTab === "statuses" ? "bg-slate-200" : ""}`}
              >
                <AlertTriangle size={20} />
                <span>Статусы</span>
              </a>
            </li>
            <li>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab("appearance");
                }}
                className={`flex items-center space-x-3 p-2 rounded-md ${activeTab === "appearance" ? "bg-slate-200" : ""}`}
              >
                <Palette size={20} />
                <span>Оформление</span>
              </a>
            </li>
          </ul>
        </div>

        {/* Content */}
        <div className="w-3/4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          {renderContent()}
          <div className="mt-6">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Сохранить изменения
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
