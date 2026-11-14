import React, { useState } from 'react';

const API = 'http://127.0.0.1:5000/api';

const specs = {
  patients: {
    fields: ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth'],
    required: ['firstName', 'lastName', 'email', 'phone']
  },
  dentists: {
    fields: ['firstName', 'lastName', 'specialty', 'email'],
    required: ['firstName', 'lastName', 'specialty', 'email']
  },
  appointments: {
    fields: [
      'patient',
      'dentist',
      'appointmentDate',
      'reason',
      'status',
      'notes'
    ],
    required: ['patient', 'appointmentDate', 'reason']
  }
};

function toArray(data, section) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.[section])) return data[section];

  throw new Error(
    `Unexpected response format for ${section}`
  );
}

export default function App() {
  const [token, setToken] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [tab, setTab] = useState('patients');
  const [items, setItems] = useState([]);
  const [patients, setPatients] = useState([]);
  const [dentists, setDentists] = useState([]);

  const [form, setForm] = useState({});
  const [editId, setEditId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  async function request(
    path,
    method = 'GET',
    body,
    auth = token
  ) {
    let response;

    try {
      response = await fetch(`${API}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(auth
            ? { Authorization: `Bearer ${auth}` }
            : {})
        },
        ...(body !== undefined
          ? { body: JSON.stringify(body) }
          : {})
      });
    } catch {
      throw new Error(
        'Cannot connect to backend. Check port 5000.'
      );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        `${data.message || 'Request failed'} ` +
        `(HTTP ${response.status}, ${path})`
      );
    }

    return data;
  }

  async function fetchCollection(section, auth = token) {
    const result = await request(
      `/${section}`,
      'GET',
      undefined,
      auth
    );

    return toArray(result, section);
  }

  async function load(section = tab, auth = token) {
    setLoading(true);
    setLoadError(false);
    setMessage('');

    try {
      // The selected collection is mandatory.
      const records = await fetchCollection(section, auth);

      setItems(records);
      setTab(section);
      setForm({});
      setEditId('');

      if (section === 'patients') {
        setPatients(records);
      }

      if (section === 'dentists') {
        setDentists(records);
      }

      // Load related collections independently.
      // Failure of dentists must not hide patients.
      const related = [];

      if (section !== 'patients') {
        related.push('patients');
      }

      if (section !== 'dentists') {
        related.push('dentists');
      }

      const results = await Promise.allSettled(
        related.map(item => fetchCollection(item, auth))
      );

      const warnings = [];

      results.forEach((result, index) => {
        const collection = related[index];

        if (result.status === 'fulfilled') {
          if (collection === 'patients') {
            setPatients(result.value);
          }

          if (collection === 'dentists') {
            setDentists(result.value);
          }
        } else {
          warnings.push(
            `${collection}: ${result.reason.message}`
          );

          if (collection === 'patients') {
            setPatients([]);
          }

          if (collection === 'dentists') {
            setDentists([]);
          }
        }
      });

      if (warnings.length > 0) {
        setMessage(
          `Loaded ${section}. Related data unavailable: ` +
          warnings.join('; ')
        );
      } else {
        setMessage(
          `${section} loaded successfully ` +
          `(${records.length} records)`
        );
      }

      return true;
    } catch (error) {
      setItems([]);
      setTab(section);
      setLoadError(true);
      setMessage(error.message);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function login(register = false) {
    setLoading(true);
    setMessage('');

    try {
      if (register) {
        await request(
          '/auth/register',
          'POST',
          { name, email, password },
          ''
        );

        setMessage(
          'Registered successfully. Now sign in.'
        );

        return;
      }

      const result = await request(
        '/auth/login',
        'POST',
        { email, password },
        ''
      );

      if (!result.token) {
        throw new Error(
          'Login response does not contain a token.'
        );
      }

      setToken(result.token);
      setRole(result.role || result.user?.role || 'staff');
      setPassword('');

      await load('patients', result.token);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(item) {
    const next = {};

    for (const fieldName of specs[tab].fields) {
      const value = item[fieldName];

      if (fieldName === 'appointmentDate' && value) {
        const date = new Date(value);

        if (!Number.isNaN(date.getTime())) {
          const localDate = new Date(
            date.getTime() -
            date.getTimezoneOffset() * 60000
          );

          next[fieldName] =
            localDate.toISOString().slice(0, 16);
        } else {
          next[fieldName] = '';
        }
      } else if (fieldName === 'dateOfBirth' && value) {
        next[fieldName] = String(value).slice(0, 10);
      } else if (value && typeof value === 'object') {
        next[fieldName] = value._id || '';
      } else {
        next[fieldName] = value ?? '';
      }
    }

    setEditId(item._id);
    setForm(next);
    setMessage('Editing record');
  }

  async function save(event) {
    event.preventDefault();

    const wasEditing = Boolean(editId);
    const payload = {};

    for (const fieldName of specs[tab].fields) {
      const value = form[fieldName];

      if (value !== undefined && value !== '') {
        payload[fieldName] = value;
      }
    }

    setLoading(true);
    setMessage('');

    try {
      await request(
        `/${tab}${wasEditing ? `/${editId}` : ''}`,
        wasEditing ? 'PUT' : 'POST',
        payload
      );

      const refreshed = await load(tab);

      if (refreshed) {
        setMessage(
          wasEditing
            ? 'Updated successfully'
            : 'Created successfully'
        );
      } else {
        setMessage(
          'Saved, but refreshing records failed. ' +
          'Use the section button to retry.'
        );
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this record?')) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await request(`/${tab}/${id}`, 'DELETE');

      const refreshed = await load(tab);

      if (refreshed) {
        setMessage('Deleted successfully');
      } else {
        setMessage(
          'Deleted, but refreshing records failed.'
        );
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function field(fieldName) {
    const options =
      fieldName === 'patient'
        ? patients
        : fieldName === 'dentist'
          ? dentists
          : null;

    const required =
      specs[tab].required.includes(fieldName);

    const value = form[fieldName] ?? '';

    if (options !== null) {
      return (
        <label key={fieldName}>
          {fieldName}
          <select
            value={value}
            required={required}
            onChange={event =>
              setForm({
                ...form,
                [fieldName]: event.target.value
              })
            }
          >
            <option value="">
              Choose {fieldName}
            </option>

            {options.map(item => (
              <option
                key={item._id}
                value={item._id}
              >
                {item.firstName} {item.lastName}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (fieldName === 'status') {
      return (
        <label key={fieldName}>
          status
          <select
            value={value || 'scheduled'}
            onChange={event =>
              setForm({
                ...form,
                status: event.target.value
              })
            }
          >
            <option value="scheduled">
              scheduled
            </option>
            <option value="completed">
              completed
            </option>
            <option value="cancelled">
              cancelled
            </option>
          </select>
        </label>
      );
    }

    const inputType =
      fieldName === 'appointmentDate'
        ? 'datetime-local'
        : fieldName === 'dateOfBirth'
          ? 'date'
          : fieldName === 'email'
            ? 'email'
            : 'text';

    return (
      <label key={fieldName}>
        {fieldName}
        <input
          type={inputType}
          value={value}
          required={required}
          onChange={event =>
            setForm({
              ...form,
              [fieldName]: event.target.value
            })
          }
        />
      </label>
    );
  }

  function signOut() {
    setToken('');
    setRole('');
    setPassword('');
    setItems([]);
    setPatients([]);
    setDentists([]);
    setForm({});
    setEditId('');
    setLoadError(false);
    setMessage('Signed out');
  }

  return (
    <main>
      <header>
        <h1>DentaCode</h1>
        <p>
          Dental Appointment System — COMP229
        </p>
      </header>

      <p role="status">{message}</p>

      {!token ? (
        <section>
          <h2>Sign in or register</h2>

          <label>
            Name (registration)
            <input
              value={name}
              onChange={event =>
                setName(event.target.value)
              }
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={event =>
                setEmail(event.target.value)
              }
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={event =>
                setPassword(event.target.value)
              }
            />
          </label>

          <button
            type="button"
            disabled={loading}
            onClick={() => login(false)}
          >
            Sign in
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => login(true)}
          >
            Register staff account
          </button>
        </section>
      ) : (
        <>
          <nav>
            {Object.keys(specs).map(section => (
              <button
                key={section}
                type="button"
                disabled={loading}
                onClick={() => load(section)}
              >
                {section}
              </button>
            ))}

            <button
              type="button"
              onClick={signOut}
            >
              Sign out ({role})
            </button>
          </nav>

          <section>
            <h2>{tab}</h2>

            <form onSubmit={save}>
              {specs[tab].fields.map(field)}

              <button
                type="submit"
                disabled={loading}
              >
                {editId ? 'Update' : 'Create'}
              </button>

              {editId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditId('');
                    setForm({});
                    setMessage('Edit cancelled');
                  }}
                >
                  Cancel edit
                </button>
              )}
            </form>
          </section>

          <section>
            <h2>Records</h2>

            {loading ? (
              <p>Loading...</p>
            ) : loadError ? (
              <p>
                Unable to load records.
                Check the error above.
              </p>
            ) : items.length === 0 ? (
              <p>No records yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Record</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(item => (
                    <tr key={item._id}>
                      <td>
                        <pre>
                          {JSON.stringify(item, null, 2)}
                        </pre>
                      </td>

                      <td>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => remove(item._id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  );
}
