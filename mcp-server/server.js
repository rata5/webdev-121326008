const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');
const { AppError } = require('../src/services/errors');

console.log = console.error;

// The lectures, read once when the server starts.
const lectures = JSON.parse(fs.readFileSync(path.join(__dirname, 'lectures.json'), 'utf8'));

// A tool result: one text part, and whether the tool failed.
function textResult(id, text, isError) {
  return { jsonrpc: '2.0', id: id, result: { content: [{ type: 'text', text: text }], isError: isError } };
}

// The tools this server offers. The description is what the model reads to choose.
const tools = [
  {
    name: 'find_lecture',
    description: 'Return the title and topics of one course lecture by its number, 1 to 12. Use it when asked what a lecture covers.',
    inputSchema: {
      type: 'object',
      properties: { number: { type: 'integer', description: 'Lecture number, 1 to 12' } },
      required: ['number'],
    },
  },
  {
    name: 'list_lectures',
    description: 'List the number and title of every course lecture. Use it when asked what the course covers.',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ---- LabBookingBg tools (Exercise 3) ---------------------------------------------------
// Each tool calls the same service function as the matching HTTP route, as the user whose
// session token is in MCP_TOKEN: a tool may do exactly what that user may do on the website.
// The database opens on the first project tool call, so the protocol works without one.
let project;
function services() {
  if (!project) {
    if (!process.env.DATABASE_URL) throw new AppError('NOT_CONFIGURED', 'DATABASE_URL is not set: add it to .env, the same as for npm start.');
    const { openDatabase } = require('../src/data/db');
    const { createServices } = require('../src/services');
    const db = openDatabase(process.env.DATABASE_URL);
    project = db.ready().then(() => createServices({ db }), (err) => {
      project = null; // try again on the next call
      throw err;
    });
  }
  return project;
}

// Tests hand in services built on an in-memory database.
function useServices(built) {
  project = Promise.resolve(built);
}

// The signed-in user behind MCP_TOKEN. Without one, every project tool is refused.
async function caller() {
  const { auth } = await services();
  const user = await auth.userForToken(process.env.MCP_TOKEN || null);
  if (!user) throw new AppError('NOT_SIGNED_IN', 'MCP_TOKEN is missing or has expired: sign in on the website and copy a fresh session token into MCP_TOKEN.');
  return user;
}

const pad = (n) => String(n).padStart(2, '0');

const projectTools = [
  {
    name: 'list_labs',
    description: 'List every lab with its id, name, room number and capacity. Use it when the user asks which labs exist or which lab is big enough for a group.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      await caller();
      const { labService } = await services();
      const { labs } = await labService.listWithSlots(labService.todayDate());
      return labs.map((lab) => `Lab ${lab.id}: ${lab.name}, room ${lab.room}, ${lab.capacity} seats`).join('\n') || 'There are no labs yet.';
    },
  },
  {
    name: 'find_free_slots',
    description: 'Return the free one-hour slots (08:00-20:00, Monday to Friday) for one lab or for all labs on a date. Use it when the user asks when a lab is free, or wants to book and has not picked a slot yet.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'The day, as YYYY-MM-DD' },
        labId: { type: 'integer', description: 'Only this lab; leave it out for every lab' },
      },
      required: ['date'],
    },
    run: async ({ date, labId }) => {
      await caller();
      const { labService } = await services();
      const { open, labs } = await labService.listWithSlots(date);
      if (!open) return `Labs are closed on ${date}. Pick a day from Monday to Friday.`;
      const lines = labs.filter((lab) => labId === undefined || lab.id === labId).map((lab) => {
        const free = lab.slots.filter((slot) => slot.bookable).map((slot) => slot.label);
        return `Lab ${lab.id}, ${lab.name} (room ${lab.room}): ${free.length ? free.join(', ') : 'no free slots'}`;
      });
      return lines.join('\n') || `There is no lab ${labId}.`;
    },
  },
  {
    name: 'book_slot',
    description: 'Book one free slot in one lab for the signed-in user. Refuses past slots, taken slots and a 4th upcoming booking, with the same messages as the website. Use it only after the user has confirmed the lab, the date and the hour.',
    inputSchema: {
      type: 'object',
      properties: {
        labId: { type: 'integer', description: 'The lab, from list_labs' },
        date: { type: 'string', description: 'The day, as YYYY-MM-DD' },
        hour: { type: 'integer', description: 'The start hour, 8 to 19' },
      },
      required: ['labId', 'date', 'hour'],
    },
    run: async ({ labId, date, hour }) => {
      const user = await caller();
      const { bookingService } = await services();
      const booking = await bookingService.book(user, { labId, date, hour });
      return `Booking confirmed: booking ${booking.id}, lab ${booking.lab_id}, ${booking.date} at ${pad(booking.start_hour)}:00.`;
    },
  },
  {
    name: 'list_my_bookings',
    description: 'List the upcoming bookings of the signed-in user, with booking id, lab, date and hour. Use it when the user asks what they have booked, or wants to cancel something.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => {
      const user = await caller();
      const { bookingService } = await services();
      const mine = await bookingService.upcomingFor(user);
      return mine.map((b) => `Booking ${b.id}: ${b.lab_name}, room ${b.room}, ${b.date} at ${pad(b.start_hour)}:00`).join('\n') || 'No upcoming bookings.';
    },
  },
  {
    name: 'cancel_booking',
    description: 'Cancel one booking by its id, which frees the slot again. Refuses a booking that belongs to somebody else. Use it when the user asks to cancel a booking they own.',
    inputSchema: {
      type: 'object',
      properties: { bookingId: { type: 'integer', description: 'The booking id, from list_my_bookings' } },
      required: ['bookingId'],
    },
    run: async ({ bookingId }) => {
      const user = await caller();
      const { bookingService } = await services();
      await bookingService.cancel(user, bookingId);
      return `Booking ${bookingId} is cancelled. The slot is free again.`;
    },
  },
];

// A refusal from a rule is a normal result marked isError, with the sentence the website shows.
async function runProjectTool(id, tool, args) {
  try {
    return textResult(id, await tool.run(args), false);
  } catch (err) {
    if (err instanceof AppError) return textResult(id, err.message, true);
    console.error(err);
    return textResult(id, 'Something went wrong on the server. Please try again.', true);
  }
}

// Print one reply as one line of JSON on stdout.
function send(reply) {
  process.stdout.write(JSON.stringify(reply) + '\n');
}

// Decide what to answer. Resolves to the reply, or to null to answer nothing.
async function handle(msg) {
  if (msg.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: msg.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'lectures', version: '0.1.0' },
      },
    };
  }
  if (msg.method === 'notifications/initialized') {
    return null; // a notification: it has no id and gets no reply
  }
  if (msg.method === 'tools/list') {
    const listed = tools.concat(projectTools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })));
    return { jsonrpc: '2.0', id: msg.id, result: { tools: listed } };
  }
  if (msg.method === 'tools/call') {
    const name = msg.params.name;
    const args = msg.params.arguments || {};
    if (name === 'find_lecture') {
      const lecture = lectures.find((l) => l.number === args.number);
      if (!lecture) {
        // The tool ran and failed: a normal result the model can read, marked isError.
        return textResult(msg.id, 'There is no lecture ' + args.number + '. The course has lectures 1 to 12.', true);
      }
      return textResult(msg.id, 'Lecture ' + lecture.number + ': ' + lecture.title + '. Topics: ' + lecture.topics, false);
    }
    if (name === 'list_lectures') {
      return textResult(msg.id, lectures.map((l) => l.number + '. ' + l.title).join('\n'), false);
    }

    const projectTool = projectTools.find((t) => t.name === name);
    if (projectTool) return runProjectTool(msg.id, projectTool, args);
    // A tool we never offered: the message itself is wrong, so it is a protocol error.
    return { jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: 'Unknown tool: ' + name } };
  }
  if (msg.id !== undefined) {
    // Any other request we do not know.
    return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Unknown method: ' + msg.method } };
  }
  return null;
}

module.exports = { handle, useServices };

// Started as a program (npm run mcp), not loaded by a test: read requests from stdin.
if (require.main === module) {
  const lines = readline.createInterface({ input: process.stdin });
  // One message at a time, in the order they arrive, so the replies keep that order too.
  let queue = Promise.resolve();
  lines.on('line', (line) => {
    console.error('got: ' + line);
    queue = queue.then(async () => {
      const reply = await handle(JSON.parse(line));
      if (reply) send(reply);
    }).catch((err) => console.error(err));
  });
}