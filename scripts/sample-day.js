/**
 * A realistic full day, written straight into localStorage, for the walk in
 * scripts/sweep.mjs and for looking at the app with something real in it.
 *
 * Not the demo. The demo (src/lib/demo.ts) is a sample fortnight under its
 * own storage key, built to be shown to a stranger; this is one person's
 * ordinary Friday under the real key, built to be measured - ten tasks with
 * three key ones, a reading block bound to a library list, four goals, five
 * in the backlog, two in the inbox, a scratch stream, three templates, a
 * weekday map, and forty days behind it so the calendar and Review have
 * something to draw.
 *
 * Options, all off by default:
 *   heavy           twenty tasks today, thirty backlog items, fifteen books
 *   extraToday      that many more anchors on today, for a crowded grid
 *   calendarEvents  that many external calendar events in the local cache
 *
 * A plain function expression rather than a module: sweep.mjs reads the file
 * as text and evaluates it inside the page, which is the only place
 * localStorage exists.
 */
(function seed(opts) {
  const heavy = opts && opts.heavy
  const extraToday = (opts && opts.extraToday) || 0
  const calendarEvents = (opts && opts.calendarEvents) || 0
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const shift = n => { const d = new Date(now); d.setDate(d.getDate() + n); return key(d) }
  const today = key(now)
  const stamp = new Date(now.getTime() - 3600e3).toISOString()
  let n = 0
  const id = p => `${p}-${(++n).toString(36)}-seed`

  const T = (over) => Object.assign({ id: id('t'), title: 'Task', done: false, updatedAt: stamp }, over)

  const listBooks = id('list')
  const listWatch = id('list')
  const bookIds = []
  const books = [
    ['Deep Work', 12], ['Atomic Habits', 20], ['The Body Keeps the Score', 21],
    ['Thinking, Fast and Slow', 38], ['Range', 15], ['Four Thousand Weeks', 14],
    ['Why We Sleep', 16], ['The Creative Act', 78],
  ].map(([title, total], i) => {
    const item = { id: id('item'), title, total, progress: i === 0 ? 5 : 0, updatedAt: stamp }
    if (i === 0) item.pace = 'one chapter an evening'
    if (i === 1) item.track = 'pages', item.total = 306
    bookIds.push(item.id)
    return item
  })
  const watching = [
    ['Severance', 3, 10], ['Andor', 2, 12], ['The Bear', 4, 10],
    ['Shogun', 1, 10], ['Slow Horses', 4, 6], ['Dune: Part Two', null, null],
    ['Arrival', null, null],
  ].map(([title, seasons, eps]) => {
    if (seasons === null) return { id: id('item'), title, track: 'movie', updatedAt: stamp }
    return { id: id('item'), title, track: 'series', seasons, season: 1, total: eps, progress: 2, updatedAt: stamp }
  })

  const tmplWork = id('tpl')
  const tmplShift = id('tpl')
  const tmplRest = id('tpl')
  const templates = [
    {
      id: tmplWork, name: 'Working day', color: '#a7c4f5', updatedAt: stamp,
      blocks: [
        { id: id('b'), time: '07:00', title: 'Get up, shower, coffee', minutes: 45, category: 'routine' },
        { id: id('b'), time: '08:00', title: 'Plan the day', minutes: 15, core: true, category: 'core' },
        { id: id('b'), time: '09:00', title: 'Deep work block', minutes: 120, core: true, category: 'core' },
        { id: id('b'), time: '12:30', title: 'Lunch', minutes: 45, category: 'meal' },
        { id: id('b'), time: '13:30', title: 'Email and admin', minutes: 45, category: 'routine' },
        { id: id('b'), time: '17:30', title: 'Walk', minutes: 40, category: 'health' },
        { id: id('b'), time: '21:00', title: 'Reading', minutes: 30, libraryListId: listBooks, category: 'personal' },
      ],
    },
    {
      id: tmplShift, name: 'Twelve-hour shift', color: '#f5b0a7', updatedAt: stamp,
      blocks: [
        { id: id('b'), time: '06:00', title: 'Out the door', minutes: 30, category: 'commute' },
        { id: id('b'), time: '07:00', title: 'On shift', minutes: 720, core: true, unbounded: true, category: 'core' },
        { id: id('b'), time: '19:30', title: 'Eat something real', minutes: 40, category: 'meal' },
      ],
    },
    {
      id: tmplRest, name: 'Slow Sunday', color: '#a7e3bd', updatedAt: stamp,
      blocks: [
        { id: id('b'), time: '09:30', title: 'Long breakfast', minutes: 60, category: 'meal' },
        { id: id('b'), title: 'Something outside', minutes: 90, category: 'health' },
        { id: id('b'), time: '20:00', title: 'Reading', minutes: 45, libraryListId: listBooks, category: 'personal' },
      ],
    },
  ]

  // Today: ten tasks, three of them key, one bound to the reading list.
  const todayTasks = [
    T({ time: '07:00', title: 'Get up, shower, coffee', minutes: 45, done: true, category: 'routine', fromTemplate: true, origin: { type: 'template', sourceId: tmplWork } }),
    T({ time: '08:00', title: 'Plan the day', minutes: 15, done: true, core: true, category: 'core', fromTemplate: true, origin: { type: 'template', sourceId: tmplWork } }),
    T({ time: '09:00', title: 'Deep work block', minutes: 120, core: true, highlight: true, category: 'core', fromTemplate: true, note: 'The pricing page rewrite. Nothing else in this block.', subtasks: [{ id: id('s'), title: 'Outline the three sections', done: true }, { id: id('s'), title: 'Draft the middle one', done: false }, { id: id('s'), title: 'Read it back out loud', done: false }] }),
    T({ time: '11:30', title: 'Call the dentist about the crown', minutes: 15, category: 'personal', highlight: true, pushCount: 2 }),
    T({ time: '12:30', title: 'Lunch', minutes: 45, done: true, category: 'meal', fromTemplate: true }),
    T({ time: '13:30', title: 'Email and admin', minutes: 45, category: 'routine', fromTemplate: true }),
    T({ time: '15:00', title: 'Review the quarter numbers with Ada', minutes: 60, core: true, highlight: true, category: 'core' }),
    T({ title: 'Order the replacement charger', minutes: 10, category: 'personal', pushCount: 1 }),
    T({ time: '17:30', title: 'Walk', minutes: 40, category: 'health', fromTemplate: true, repeat: 'weekdays' }),
    T({ time: '21:00', title: 'Reading', minutes: 30, category: 'personal', fromTemplate: true, libraryRef: { listId: listBooks, itemId: bookIds[0] } }),
  ]

  const days = {}
  days[today] = { date: today, templateId: tmplWork, dayType: 'full', autoApplied: true, updatedAt: stamp, tasks: todayTasks }

  // A fortnight behind, so the calendar, the year strip and Review have
  // something real to draw rather than an empty grid.
  for (let back = 1; back <= 40; back++) {
    const d = shift(-back)
    const weekday = new Date(now.getTime() - back * 86400e3).getDay()
    if (weekday === 0 && back % 3 === 0) { days[d] = { date: d, tasks: [], updatedAt: stamp }; continue }
    const count = 4 + ((back * 7) % 6)
    const doneCount = Math.max(1, Math.round(count * (0.35 + ((back * 13) % 60) / 100)))
    const tasks = []
    for (let i = 0; i < count; i++) {
      tasks.push(T({
        time: `${pad(8 + i)}:00`,
        title: ['Standup', 'Deep work block', 'Email and admin', 'Walk', 'Reading', 'Groceries', 'Gym', 'Call mum', 'Invoices'][i % 9],
        minutes: [30, 90, 45, 40, 30, 45, 60, 20, 30][i % 9],
        done: i < doneCount,
        core: i === 1 || i === 4,
        highlight: i === 1,
        category: ['routine', 'core', 'routine', 'health', 'personal', 'personal', 'health', 'personal', 'core'][i % 9],
      }))
    }
    days[d] = { date: d, templateId: weekday === 0 || weekday === 6 ? tmplRest : tmplWork, dayType: weekday === 0 || weekday === 6 ? 'rest' : 'full', autoApplied: true, updatedAt: stamp, tasks }
  }
  // Tomorrow, with something already on it.
  days[shift(1)] = { date: shift(1), templateId: tmplWork, autoApplied: true, updatedAt: stamp, tasks: [
    T({ time: '09:00', title: 'Deep work block', minutes: 120, core: true, category: 'core' }),
    T({ time: '14:00', title: 'Dentist', minutes: 60, category: 'health' }),
  ] }

  const backlogTitles = heavy
    ? Array.from({ length: 30 }, (_, i) => [
        'Fix the loose cupboard door', 'Move the ISA', 'Write up the Rota notes',
        'Book the car in for its service', 'Replace the bathroom bulb',
        'Cancel the gym trial', 'Back up the photos off the phone',
        'Chase the insurance refund', 'Sort the loft boxes', 'Reread the lease',
      ][i % 10] + (i >= 10 ? ` (${Math.floor(i / 10) + 1})` : ''))
    : ['Fix the loose cupboard door', 'Move the ISA', 'Write up the Rota notes', 'Book the car in for its service', 'Replace the bathroom bulb']

  // Built before the data object so the rules below can point at them. Every
  // rule belongs to a goal now - see views/north/NorthView.tsx - and a sample
  // whose rules were all unfiled would put the North window's waiting group on
  // every screenshot the sweep takes.
  const goals = [
    { id: id('g'), title: 'Finish the book proposal', why: 'Because I keep telling people about it instead of writing it', identity: 'I am someone who finishes what they start talking about', createdAt: shift(-96), updatedAt: stamp },
    { id: id('g'), title: 'Be strong at fifty', why: 'Dad could not carry his own suitcase at sixty and it changed what he could do', identity: 'I am someone who trains, not someone who used to', createdAt: shift(-41), updatedAt: stamp },
    { id: id('g'), title: 'Read the eight books on the shelf', why: 'They were all bought for a reason I can still remember', identity: 'I am someone who reads the books he buys', createdAt: shift(-12), updatedAt: stamp },
    { id: id('g'), title: 'Leave the house before nine on a Saturday', why: 'The best days this year all started outside', identity: 'I am someone whose weekends start early', createdAt: shift(-3), updatedAt: stamp },
  ]

  const data = {
    templates,
    days,
    settings: {
      theme: { presetId: 'dark', mode: 'dark', overrides: {} },
      enabledWidgets: ['day-plan', 'year-strip'],
      timelineExpanded: true,
      dayLayoutFocus: 'both',
      density: 'comfortable',
      textScale: 'm',
      reminder: { enabled: false, everyMinutes: 20, text: 'Stand up, drink water' },
      sleepProfiles: [{ id: 'default', name: 'Weeknights', window: { start: '23:00', end: '07:00' } }],
      weekdayTemplates: { 1: tmplWork, 2: tmplWork, 3: tmplWork, 4: tmplWork, 5: tmplWork, 0: tmplRest, 6: tmplRest },
      taskReminder: { enabled: true, minutesBefore: 10 },
      north: { afterASlowDay: true, onMonday: true },
      eveningClose: { enabled: true, at: '21:30', askBestMoment: true },
    },
    ifThens: [
      { id: id('if'), goalId: goals[0].id, trigger: 'The laptop is still open at 22:00', action: 'Close it and put it in the hall', updatedAt: stamp },
      { id: id('if'), goalId: goals[1].id, trigger: 'I open the fridge with nothing in mind', action: 'Drink a glass of water first', color: '#9ed9e8', updatedAt: stamp },
      { id: id('if'), goalId: goals[1].id, trigger: 'A meeting ends early', action: 'Walk to the end of the road and back', updatedAt: stamp },
      { id: id('if'), goalId: goals[2].id, trigger: 'I sit down and reach for the phone', action: 'The book is already on the arm of the chair', updatedAt: stamp },
    ],
    inbox: [
      { id: id('in'), text: 'Ask Ada whether the Q3 deck is still the right one', captured: stamp, updatedAt: stamp },
      { id: id('in'), text: 'Something about the boiler pressure', captured: stamp, updatedAt: stamp },
    ],
    backlog: backlogTitles.map((title, i) => ({ id: id('bk'), title, category: ['personal', 'core', 'routine', 'personal', 'routine'][i % 5], minutes: [30, 45, 60, 20, 10][i % 5], updatedAt: stamp })),
    scratch: [
      { id: id('sc'), text: 'Meter reading 41882 #house', createdAt: stamp, date: today, updatedAt: stamp },
      { id: id('sc'), text: 'The week view drops a block when you drag it past the last column #bug', createdAt: stamp, date: today, updatedAt: stamp },
      { id: id('sc'), text: 'Ada: her sister is called Nel, not Nell', createdAt: stamp, date: today, updatedAt: stamp },
      { id: id('sc'), text: 'Try the coffee place on Vokieciu', createdAt: stamp, date: shift(-1), updatedAt: stamp, pinned: true },
      { id: id('sc'), text: 'Reading light, warm white, under 20 quid #house', createdAt: stamp, date: shift(-2), updatedAt: stamp },
    ],
    library: [
      { id: listBooks, name: 'Books', unit: 'chapter', unitShort: 'ch', color: '#a7c4f5', items: heavy ? books.concat(Array.from({ length: 7 }, (_, i) => ({ id: id('item'), title: `Backlog book number ${i + 1}`, total: 10 + i, progress: 0, updatedAt: stamp }))) : books, updatedAt: stamp },
      { id: listWatch, name: 'Watching', unit: 'episode', unitShort: 'ep', color: '#c9b3f0', items: watching, updatedAt: stamp },
    ],
    goals,
  }

  if (heavy) {
    // Twenty on today, to see what a genuinely full day does to every screen.
    const extra = ['Rebook the flights', 'Read the contract properly', 'Physio exercises', 'Water the plants',
      'Reply to the landlord about the boiler and the window latch as well', 'Wash the car',
      'Find the passport', 'Ten minutes of Lithuanian', 'Sort the receipts', 'Ring the bank']
    extra.forEach((title, i) => {
      data.days[today].tasks.push(T({ time: i < 6 ? `${pad(10 + i)}:${i % 2 ? '15' : '45'}` : undefined, title, minutes: [20, 45, 15, 10, 25, 60, 30, 10, 40, 15][i], category: ['personal', 'core', 'health', 'routine', 'personal', 'personal', 'personal', 'core', 'routine', 'personal'][i] }))
    })
  }

  for (let i = 0; i < extraToday; i++) {
    const m = 8 * 60 + ((i * 7) % (14 * 60))
    data.days[today].tasks.push(T({ time: pad(Math.floor(m / 60)) + ':' + pad(m % 60), title: 'Filler task number ' + (i + 1), minutes: 15 + (i % 4) * 15, category: 'personal' }))
  }
  if (calendarEvents) {
    data.settings.calendars = [{ id: 'cal-1', name: 'Work', color: '#a7c4f5', enabled: true }]
    const events = []
    for (let i = 0; i < calendarEvents; i++) {
      const start = new Date(now); start.setDate(start.getDate() - 200 + (i % 400))
      const m = 8 * 60 + ((i * 37) % (10 * 60))
      events.push({ uid: 'ev' + i, summary: 'Meeting ' + i, date: key(start), startMinutes: m, minutes: 30, allDay: false })
    }
    localStorage.setItem('dienius:calendars', JSON.stringify({ 'cal-1': { fetchedAt: new Date().toISOString(), events } }))
  }
  localStorage.setItem('dienius:data', JSON.stringify(data))
  localStorage.removeItem('dienius:yesterday-dismissed')
  localStorage.removeItem('dienius:evening-close-dismissed')
  localStorage.setItem('dienius:tour-progress', JSON.stringify({ done: true }))
  return {
    today,
    tasks: data.days[today].tasks.length,
    days: Object.keys(data.days).length,
    backlog: data.backlog.length,
    library: data.library.map(l => `${l.name}: ${l.items.length}`),
    goals: data.goals.length,
  }
})
