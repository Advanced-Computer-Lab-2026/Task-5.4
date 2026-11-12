// Test-only persistence for security tests. This deliberately does not emulate
// MongoDB validation, indexes or transactions; those need database integration tests.
const users = new Map();
const requests = new Map();
let nextId = 0;
const id = () => (++nextId).toString(16).padStart(24, '0');

function query(value) {
  return {
    populate() { return this; },
    sort() { return this; },
    lean() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
}

export const User = {
  async findOne({ email }) {
    return [...users.values()].find((user) => user.email === email) || null;
  },
  async create(data) {
    const user = { ...data, _id: id() };
    users.set(user._id, user);
    return user;
  }
};

export const MaintenanceRequest = {
  async create(data) {
    const request = { status: 'open', ...data, _id: id() };
    Object.defineProperty(request, 'deleteOne', {
      value: async () => { requests.delete(request._id); }
    });
    requests.set(request._id, request);
    return request;
  },
  find() { return query([...requests.values()]); },
  findById(requestId) { return query(requests.get(requestId) || null); },
  async findByIdAndUpdate(requestId, { $set }) {
    const request = requests.get(requestId);
    if (!request) return null;
    Object.assign(request, $set);
    return request;
  }
};

export function resetModels() {
  users.clear();
  requests.clear();
  nextId = 0;
}
