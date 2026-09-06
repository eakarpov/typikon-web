// Подгон высоты рамки виджета «Уставных чтений».
//
// Рамке снаружи не видно, какой она высоты: iframe не растёт по содержимому, и
// хозяин сайта иначе вынужден подбирать высоту руками — под самый длинный день
// в году, оставляя пустоту во все прочие. Виджет сообщает свою высоту сам, а
// этот скрипт её слушает.
//
// Подключать необязательно: без него рамка просто останется той высоты, что
// указана в теге. Пятнадцать строк, ничего не требуют и ни от чего не зависят.
//
//   <script src="https://www.typikon.su/embed.js" async></script>
(function () {
    "use strict";
    window.addEventListener("message", function (event) {
        var data = event.data;
        // Чужие сообщения ходят по той же трубе: на странице бывает и чат, и
        // счётчик, и карта. Слушаем только своё и только числа.
        if (!data || data.typikon !== "height" || typeof data.height !== "number") return;

        var frames = document.querySelectorAll("iframe");
        for (var i = 0; i < frames.length; i++) {
            // Сверяем окно, а не адрес: адрес рамки мог быть переписан
            // параметрами, а окно у события одно и подделать его нельзя.
            if (frames[i].contentWindow === event.source) {
                frames[i].style.height = Math.max(40, data.height) + "px";
                frames[i].setAttribute("scrolling", "no");
            }
        }
    });
})();
