export default async function handler(req, res) {

  const API_KEY = process.env.TMDB_KEY
  const BASE = "https://api.themoviedb.org/3"

  const page = req.query.page || 1
  const genre = req.query.genre || ""
  const sort = req.query.sort || "popularity.desc"

  const url = `${BASE}/discover/movie?api_key=${API_KEY}&page=${page}&with_genres=${genre}&sort_by=${sort}`

  const response = await fetch(url)
  const data = await response.json()

  res.status(200).json(data)

}