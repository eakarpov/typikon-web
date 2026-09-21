'use client';
import React from "react";

const Content = ({ item }: { item : any }) => {
    const [name, setName] = React.useState<string>(item.name || "");
    const [surname, setSurname] = React.useState<string>(item.surname || "");
    const [email, setEmail] = React.useState<string>(item.email || "");
    const [phone, setPhone] = React.useState<string>(item.phone || "");
    // Привязки входа здесь больше не показываются: они переехали в Logins,
    // где их можно не только видеть, но и заводить. Эта форма — о том, что
    // человек набирает сам.

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
      </div>
    );
};

export default Content;