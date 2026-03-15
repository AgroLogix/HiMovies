export default async function handler(req, res) {

  const API_KEY = process.env.TMDB_KEY
  const BASE = "https://api.themoviedb.org/3"

  const endpoint = req.query.endpoint || "/discover/movie"

  const params = new URLSearchParams(req.query)
  params.delete("endpoint")

  const url = `${BASE}${endpoint}?api_key=${API_KEY}&${params.toString()}`

  const response = await fetch(url)
  const data = await response.json()

  res.status(200).json(data)

}