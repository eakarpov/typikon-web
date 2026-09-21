'use client';
import React from "react";

const Content = ({ item }: { item : any }) => {
    const [name, setName] = React.useState<string>(item.name || "");
    const [surname, setSurname] = React.useState<string>(item.surname || "");
    const [email, setEmail] = React.useState<string>(item.email || "");
    const [phone, setPhone] = React.useState<string>(item.phone || "");
    // Привязки входа показываются, но не набираются: привязка — следствие входа,
    // проверенного у провайдера, и сервер её из формы не принимает.
    const vkId: string = item.auth?.vk?.userId || "";
    const googleId: string = item.auth?.google?.userId || "";
    const telegramId: string = item.auth?.telegram?.userId || "";

    const [isSaved, setIsSaved] = React.useState(false);
    const [error, setError] = React.useState("");

    const onSubmit = () => {
        setIsSaved(false);
        setError("");
        const data = {
            name,
            surname,
            email,
            phone,
        };
        fetch(`/api/profile`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data }),
        }).then((res) => {
            if (res.ok) {
                setIsSaved(true);
            } else if (res.status === 409) {
                setError("Эта почта уже указана в другой учётной записи.");
            } else {
                setError("Не сохранено: проверьте поля.");
            }
        }).catch(() => setError("Не сохранено: нет связи."));
    };

    return (
      <div>
          <p>
              Ваши данные
          </p>
          <button onClick={onSubmit}>
              {isSaved ? "Сохранено!" : "Сохранить"}
          </button>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          <div className="flex flex-col pr-4">
              <label>
                  Имя
              </label>
              <input
                  className="border-2"
                  value={name}
                  onChange={e => setName(e.target.value)}
              />
          </div>
          <div className="flex flex-col pr-4">
              <label>
                  Фамилия
              </label>
              <input
                  className="border-2"
                  value={surname}
                  onChange={e => setSurname(e.target.value)}
              />
          </div>
          <div className="flex flex-col pr-4">
              <label>
                  Email
              </label>
              <input
                  className="border-2"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
              />
          </div>
          <div className="flex flex-col pr-4">
              <label>
                  Телефон
              </label>
              <input
                  className="border-2"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
              />
          </div>
          <div className="flex flex-col pr-4">
              <label>
                  VK ID
              </label>
              <input
                  className="border-2"
                  value={vkId}
                  readOnly
                  disabled
              />
          </div>
          <div className="flex flex-col pr-4">
              <label>
                  Google ID
              </label>
              <input
                  className="border-2"
                  value={googleId}
                  readOnly
                  disabled
              />
          </div>
          <div className="flex flex-col pr-4">
              <label>
                  Telegram ID
              </label>
              <input
                  className="border-2"
                  value={telegramId}
                  readOnly
                  disabled
              />
          </div>
      </div>
    );
};

export default Content;