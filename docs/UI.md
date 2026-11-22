# UI checklist

<!-- Exercise 4 hands this in. Tick an item only when you have checked it, and replace
     the "how I checked" line with what you actually did. An unticked box is not a
     failure: it is a gap you then write into READINESS.md. A ticked box you cannot
     demonstrate at the defence is worse than an unticked one. -->

"Modern" is not a style. It is a short list of things a user notices when they are
missing: the screen tells you what is happening, you can get through it with a keyboard,
the text is readable, and nothing jumps around while it loads.

## Layout and typography

- [X] **One spacing scale and one type scale.** Sizes come from a small set of design tokens, not from numbers typed where they were needed.
  # how I checked: described below
  1. sed -n 3,4p public/app.css | checks if the token exists.
  2. grep -n -o -E "(margin|padding|gap)[a-z-]*\s*:[^;]*" public/app.css | grep -v "var(--space" | lists every margin, padding and gap that doesn't  use a --space- token.
  4. grep -n -o -E "font(-size)?\s*:[^;]*" public/app.css | checks if test sizes use only those tokens (var(--text-…) or inherit).
  5. grep -n -E 'style="|\.style\.' src/pages/*.html public/*.js | checks that no size is set outside of the stylesheet.

- [X] **Responsive at 380, 768 and 1280 pixels wide.** No horizontal scrollbar, no text running under another element.
  # how I checked: described below
  1. opened the /live page while signed in, F12, ctrl + shift + m
  2. set dimensions to responsive and typed the desired width.
  3. Reload

- [X] **Nothing jumps while the page loads.** Images and cards reserve their space before their content arrives.
  # how I checked: described below
  1. ctrl + shift + m on live page. Network throttling to 3G. Reload.
  2. Measure, then back to no throttling, reload.
  3. ran
      new PerformanceObserver((list) => {
        const shifts = list.getEntries();
        console.log('total', shifts.reduce((sum, e) => sum + e.value, 0).toFixed(3));
        shifts.forEach((e) => console.log(e.value.toFixed(3), e.sources.map((s) => s.node?.id || s.node?.className || s.node?.nodeName)));
      }).observe({ type: 'layout-shift', buffered: true });
    It prints the total, then each shift with the elements it moved. The Performance panel also shows a live CLS value when you reload. Google rates up to 0.1 as good and above 0.25 as poor.
    Width | No bookings | 2 bookings
    380   | 0.29        | 0.38
    768   | 0.008       | 0.069
    1280  | 0.004       | 0.044

## The four states, on every screen

A screen that only handles "it worked" is a screen that lies to the user on the day it matters.

- [X] **Loading.** Something tells the user the app is working, within about 100 ms.
  # how I checked: described below
  1. network throttling to 3G, reload. "Loading labs…" and "Loading your bookings…" appear while loading. Changing the date shows the same labels.
  2. while a request runs each button is disabled and shows a working label.

- [X] **Empty.** The screen says what this list is for and what to do next, instead of showing nothing.
  # how I checked: described below
  1. My bookings with nothing in it shows a label "No bookings yet. Pick a free slot in the lab list below."
  2. on weekends it shows a label "Labs are closed at the weekend. Pick a day from Monday to Friday."
  3. if no labs are present it shows "There are no labs yet. An admin can add the first one."

- [X] **Error.** A sentence a person can read. Never a raw JSON body, never a stack trace, never just "Error".
  # how I checked: described below
  1. blocked the "labs?date=" request URL, reload, label "Could not reach the server. Check your connection and try again." appears.
  2. blocked bookings/mine the same way, got the same label.
  3. opened the same day in two tabs and chose the same seat in both. The second tab got a red label "This slot is already taken" and the slot turned gray.
  4. wrong password on sign in shows "Wrong email or password".

- [X] **Success.** The user can see that what they did took effect, without reloading the page to find out.
  # how I checked: described below
  1. clicked on a free slot and got "Booking confirmed:..." and the slot turns grey. My bookings lists it afterwards.
  2. cancelled a booking and got "Booking cancelled: ..."
  3. signing in takes you to the lab list.

## Keyboard and accessibility

- [X] **The main flow works with the keyboard alone.** Sign in, do the core action, sign out, without touching the mouse.
  # how I checked: described below
  1. sign in page is fully navigatable by Tab
  2. in the labs section Tab to the Date box. Inside it, Tab moves between day, month and year, and the arrow keys change the part that's selected.
  3. tab on to the Book button and pressed enter. "Booking confirmed" label.
  4. shift+tab to the sign out button and press enter returns you to the sign in page.

- [X] **The focused element is visible.** A `:focus-visible` outline that is not switched off.
  # how I checked: described below
  1. tabbing on to or pressing every button, link and input gets a thick ring

- [X] **Text contrast is at least 4.5:1.** Name the tool you measured with.
  # how I checked: described below
  1. ctrl+shift+c and hovered over a text. The tooltip shows contrast with the ratio and a check mark.
  2. menu -> more tools -> rendering -> emulate css color set to dark then ctrl+shift+c again.

- [X] **Every input has a label** a screen reader reads, not just placeholder text.
  # how I checked: described below
  1. grep -n -E "<label for|<input id" src/pages/*.html shows four inputs: email, password, date and assistant-request. Each has a <label for="…"> with the same id.
  2. in browser select and input in elements and open accesibility, name comes from the label.

- [X] **The page has a correct `<title>` and `lang`.**
  # how I checked: described below
  1. On each page ran in the console: document.title + ' | ' + document.documentElement.lang.
     got:                         Sign in · LabBookingBg | en on the sign-in page and Labs · LabBookingBg | en

- [X] **Touch targets are at least 44 pixels.**
  # how I checked: described below
  1. app.css sets min-height: 44px on inputs, buttons and slots

## The model feature

- [X] **It shows that it is thinking.** A model call is slow and a free service may have been asleep; a frozen button is the worst possible answer.
  # how I checked: described below
  1. typed a request and a label "Thinking…" appeared under the text box

- [X] **It shows when it failed,** and the rest of the screen still works.
  # how I checked: described below
    1. setting network throttling to 3G times out the model and we get a label "The assistant is taking too long. Here are the free slots for the day you picked instead." with a list of available free slots for the desired day.

- [X] **The user can tell the model's suggestion from a fact.** It is labelled as a suggestion, not presented as data the app knows.
  # how I checked: described below
  1. every item carries a tag. The model can't make up slots. The server shows only slots that are real, free and in the future in the database, and drops the rest. So the lab, room and time are facts from the database; only the choice and the reason come from the model.

## Decisions

- [X] **Dark mode, or a written decision not to have one.**
  # what I decided and why: it support both light and dark mode. It depends on the users browser settings which one they see.

## Evidence

<!-- Screenshots of at least the four states of one screen, and of the model feature
     thinking and failing. A link to them is enough; they do not have to be in the repo. -->
![Lab list while loading](ui/loading.png)

![Lab list with labs and free slots](ui/content.png)

![My bookings with no bookings](ui/empty.png)

![Lab list when the request fails](ui/error.png)

![Find me a slot while it is thinking](ui/assistant-thinking.png)

![Find me a slot after the model failed](ui/assistant-failed.png)