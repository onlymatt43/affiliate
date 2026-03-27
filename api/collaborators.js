const { listCollaborators } = require("./_collaborators-store");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const payload = await listCollaborators();
    res.status(200).json({
      ok: true,
      collaborators: payload.collaborators,
      persistence: {
        mode: payload.mode,
        writable: payload.writable
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Unable to load collaborators" });
  }
};
