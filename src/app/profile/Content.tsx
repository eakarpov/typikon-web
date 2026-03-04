'use client';
import React from "react";

const Content = ({ item }: { item : any }) => {
    const [name, setName] = React.useState<string>(item.name || "");
    const [surname, setSurname] = React.useState<string>(item.surname || "");
    const [email, setEmail] = React.useState<string>(item.email || "");
    const [phone, setPhone] = React.useState<string>(item.phone || "");
    const [vkId, setVkId] = React.useState<string>(item.auth.vk?.userId || "");
    const [googleId, setGoogleId] = React.useState<string>(item.auth.google?.userId || "");
    const [telegramId, setTelegramId] = React.useState<string>(item.auth.telegram?.userId || "");

    const [isSaved, setIsSaved] = React.useState(false);

    const onSubmit = () => {
        setIsSaved(false);
        const data: any = {
            name,
            surname,
            email,
            phone,
        };
        if (vkId) {
            data["auth.vk.userId"] = vkId;
        }
        if (googleId) {
            data["auth.google.userId"] = googleId;
        }
        if (telegramId) {
            data["auth.telegram.userId"] = telegramId;
        }
        fetch(`/api/profile`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: item.id,
                data,
            }),
        });
    };

    return (
      <div>
          <p>
              Ваши данные
          </p>
          <button onClick={onSubmit}>
              {isSaved ? "Сохранено!" : "Сохранить"}
          </button>
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
                  onChange={e => setVkId(e.target.value)}
              />
          </div>
          <div className="flex flex-col pr-4">
              <label>
                  Google ID
              </label>
              <input
                  className="border-2"
                  value={googleId}
                  onChange={e => setGoogleId(e.target.value)}
              />
          </div>
          <div className="flex flex-col pr-4">
              <label>
                  Telegram ID
              </label>
              <input
                  className="border-2"
                  value={telegramId}
                  onChange={e => setTelegramId(e.target.value)}
              />
          </div>
      </div>
    );
};

export default Content;