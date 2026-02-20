import axios from 'axios'

const IG_GRAPH_API = 'https://graph.facebook.com/v19.0'

interface IGCredentials {
  access_token: string
  ig_user_id: string
}

export async function createIGMediaContainer(
  credentials: IGCredentials,
  imageUrl: string,
  caption: string
) {
  const { data } = await axios.post(
    `${IG_GRAPH_API}/${credentials.ig_user_id}/media`,
    {
      image_url: imageUrl,
      caption,
      access_token: credentials.access_token,
    }
  )
  return data
}

export async function publishIGMedia(credentials: IGCredentials, creationId: string) {
  const { data } = await axios.post(
    `${IG_GRAPH_API}/${credentials.ig_user_id}/media_publish`,
    {
      creation_id: creationId,
      access_token: credentials.access_token,
    }
  )
  return data
}

export async function postToInstagram(
  credentials: IGCredentials,
  imageUrl: string,
  caption: string
) {
  const container = await createIGMediaContainer(credentials, imageUrl, caption)
  await new Promise((resolve) => setTimeout(resolve, 5000))
  const published = await publishIGMedia(credentials, container.id)
  return published
}

export async function getIGProfile(accessToken: string) {
  const { data } = await axios.get(
    `${IG_GRAPH_API}/me?fields=id,username,name,profile_picture_url&access_token=${accessToken}`
  )
  return data
}
