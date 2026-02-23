
// com.reddit.popular

const redditUserAgent = "ios:io.vincode.Anthology:1.0 (by /u/rokaho)";

// Helper function to strip query parameters from URLs
function stripQueryParameters(url) {
	if (url == null) {
		return url;
	}
	try {
		const urlObject = new URL(url);
		return urlObject.origin + urlObject.pathname;
	} catch (e) {
		// If URL parsing fails, return the original URL
		return url;
	}
}

function verify() {
	const authHeaders = {"Authorization": "Bearer __ACCESS_TOKEN__", "User-Agent": redditUserAgent};
	const url = "https://oauth.reddit.com/api/v1/me";
	sendRequest(url, "GET", null, authHeaders, true)
	.then((text) => {
		const response = JSON.parse(text);

		if (response.status != 200) {
			processError(Error("Reddit authentication failed"));
			return;
		}

		const jsonObject = JSON.parse(response.body);
		const username = jsonObject.name || "Reddit User";

		const verification = {
			displayName: "u/" + username,
			icon: "https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-180x180.png"
		};
		processVerification(verification);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function load() {
	const type = feedType.toLowerCase();
	const authHeaders = {"Authorization": "Bearer __ACCESS_TOKEN__", "User-Agent": redditUserAgent};
	sendRequest(`https://oauth.reddit.com/r/popular/${type}.json?raw_json=1`, "GET", null, authHeaders)
	.then((text) => {
		if (text == null || text.length === 0 || text.charAt(0) !== '{') {
			processError(Error("Unexpected response from Reddit (not JSON)"));
			return;
		}
		const jsonObject = JSON.parse(text);

		var results = [];

		for (const child of jsonObject.data.children) {
			let item = child.data;
			let resultItem = null;
			if (item["crosspost_parent_list"] != null && item["crosspost_parent_list"][0] != null) {
				resultItem = itemForData(item["crosspost_parent_list"][0], item["subreddit"]);
			}
			else {
				resultItem = itemForData(item, null);
			}

			if (resultItem != null) {
				results.push(resultItem);
			}
		}

		processResults(results, true);
	})
	.catch((requestError) => {
		processError(requestError);
	});
}

function itemForData(item, crosspostSubreddit) {
	const author = item["author"];
	var identity = Identity.createWithName("u/" + author);
	identity.uri = "https://www.reddit.com/user/" + author;
	identity.avatar = "https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-180x180.png";

	const date = new Date(item["created_utc"] * 1000);
	const uri = "https://www.reddit.com" + encodeURI(item["permalink"]);
	let title = item["title"];
	let content = "";

	if (item["selftext_html"] != null) {
		let rawContent = item["selftext_html"];
		// convert relative links to absolute links
		let processedContent = rawContent.replace(/href="\/r\//g, "href=\"https://www.reddit.com/r/");
		content = content + processedContent;
	}

	var attachments = null;
	if (item["preview"] != null)  {
		const images = item["preview"].images;
		if (images.length > 0) {
			attachments = [];
			for (const image of images) {
				let url = stripQueryParameters(image.source.url);
				let width = image.source.width;
				let height = image.source.height;
				if (url != null) {
					const attachment = MediaAttachment.createWithUrl(url);
					attachment.mimeType = "image";
					if (width != null && height != null) {
						attachment.aspectSize = { width: width, height: height };
					}
					attachments.push(attachment);
				}
			}
		}
	}
	else if (item["gallery_data"] != null) {
		attachments = [];
		const galleryItems = item["gallery_data"].items;
		for (const galleryItem of galleryItems) {
			const mediaId = galleryItem["media_id"];
			const mediaMetadata = item["media_metadata"];
			if (mediaMetadata != null) {
				const metadata = mediaMetadata[mediaId];
				if (metadata?.status == "valid") {
					if (metadata.s != null) {
						let width = null;
						if (metadata.s.x != null) {
							width = metadata.s.x;
						}
						let height = null;
						if (metadata.s.y != null) {
							height = metadata.s.y;
						}
						let mimeType = null;
						if (metadata.m != null) {
							mimeType = metadata.m;
						}
						const image = stripQueryParameters(metadata.s.u);
						if (image != null) {
							const attachment = MediaAttachment.createWithUrl(image);
							if (width != null && height != null) {
								attachment.aspectSize = { width: width, height: height };
							}
							if (mimeType != null) {
								attachment.mimeType = mimeType;
							}
							else {
								attachment.mimeType = "image";
							}
							attachments.push(attachment);
						}
					}
				}
			}
			else {
				// NOTE: This might be an appropriate fallback: "https://i.redd.it/" + galleryItem["media_id"] + ".jpg";
			}
		}
	}
	else if (item["media_metadata"] != null) {
		attachments = [];
		const mediaMetadata = item["media_metadata"];
		for (let key in mediaMetadata) {
			const metadata = mediaMetadata[key];
			if (metadata?.status == "valid") {
				if (metadata.s != null) {
					let width = null;
					if (metadata.s.x != null) {
						width = metadata.s.x;
					}
					let height = null;
					if (metadata.s.y != null) {
						height = metadata.s.y;
					}
					let mimeType = null;
					if (metadata.m != null) {
						mimeType = metadata.m;
					}
					const image = stripQueryParameters(metadata.s.u);
					if (image != null) {
						const attachment = MediaAttachment.createWithUrl(image);
						if (width != null && height != null) {
							attachment.aspectSize = { width: width, height: height };
						}
						if (mimeType != null) {
							attachment.mimeType = mimeType;
						}
						else {
							attachment.mimeType = "image";
						}
						attachments.push(attachment);
					}
				}
				else if (metadata.hlsUrl != null) {
					const video = stripQueryParameters(metadata.hlsUrl);
					if (video != null) {
						let width = null;
						if (metadata.x != null) {
							width = metadata.x;
						}
						let height = null;
						if (metadata.y != null) {
							height = metadata.y;
						}
						const mimeType = "video";
						const attachment = MediaAttachment.createWithUrl(video);
						if (width != null && height != null) {
							attachment.aspectSize = { width: width, height: height };
						}
						attachment.mimeType = "video";
						attachments.push(attachment);
					}
				}
			}
		}
	}
	else {
		const image = stripQueryParameters(item["url"]);
		if (image != null) {
			if (image.endsWith(".jpg") || image.endsWith(".jpeg")) {
				const attachment = MediaAttachment.createWithUrl(image);
				attachment.mimeType = "image/jpeg";
				attachments = [attachment];
			}
			else {
				const thumbnail = stripQueryParameters(item["thumbnail"]);
				if (thumbnail != null && (thumbnail.endsWith(".jpg") || thumbnail.endsWith(".jpeg"))) {
					const attachment = MediaAttachment.createWithUrl(thumbnail);
					attachment.mimeType = "image/jpeg";
					attachments = [attachment];
				}
			}
		}
	}

	if (item["secure_media"] != null) {
		if (item["secure_media"].reddit_video != null && item["secure_media"].reddit_video.hls_url != null) {
			if (attachments == null) {
				attachments = [];
			}

			let videoUrl = stripQueryParameters(item["secure_media"].reddit_video.hls_url);
			let posterUrl = stripQueryParameters(item.thumbnail);
			let aspectSize = null;
			if (attachments.length > 0) {
				posterUrl = attachments[0].url ?? attachments[0].media;

				if (attachments[0].aspectSize != null) {
					aspectSize = attachments[0].aspectSize;
				}
			}

			const attachment = MediaAttachment.createWithUrl(videoUrl);
			attachment.thumbnail = posterUrl;
			if (aspectSize != null) {
				attachment.aspectSize = aspectSize;
			}
			attachment.mimeType = "video/mp4";

			// replace first attachment with video and poster image
			if (attachments.length > 0) {
				attachments[0] = attachment;
			}
			else {
				attachments.push(attachment);
			}
		}
		else if (item["preview"] != null) {
			if (item["preview"].reddit_video_preview != null && item["preview"].reddit_video_preview.hls_url != null) {
				if (attachments == null) {
					attachments = [];
				}

				let videoUrl = stripQueryParameters(item["preview"].reddit_video_preview.hls_url);
				let posterUrl = item.thumbnail;
				let aspectSize = null;
				if (attachments.length > 0) {
					posterUrl = attachments[0].url ?? attachments[0].media;

					if (attachments[0].aspectSize != null) {
						aspectSize = attachments[0].aspectSize;
					}
				}

				const attachment = MediaAttachment.createWithUrl(videoUrl);
				attachment.thumbnail = posterUrl;
				if (aspectSize != null) {
					attachment.aspectSize = aspectSize;
				}
				attachment.mimeType = "video/mp4";

				// replace first attachment with video and poster image
				if (attachments.length > 0) {
					attachments[0] = attachment;
				}
				else {
					attachments.push(attachment);
				}
			}
		}
		else if (item["secure_media_embed"]?.content != null) {
			content = content + `<p>${item["secure_media_embed"].content}</p>`;
		}
	}

	if (item["post_hint"] == "link") {
		const externalURL = stripQueryParameters(item["url_overridden_by_dest"]);
		if (externalURL != null) {
			if (attachments == null) {
				attachments = [];
			}
			const attachment = LinkAttachment.createWithUrl(externalURL);
			attachments.push(attachment);
		}
	}

	var annotations = [];
	let shortcodes = null;

	// Add subreddit annotation for popular feed
	const subredditName = crosspostSubreddit || item["subreddit"];
	if (includeSubreddit == "on" && subredditName != null) {
		const subredditAnnotation = Annotation.createWithText("r/" + subredditName);
		subredditAnnotation.uri = "https://www.reddit.com/r/" + subredditName;
		annotations.push(subredditAnnotation);
	}

	// Add flair annotation
	if (includeFlair == "on") {
		if (item["link_flair_type"] != null) {
			if (item["link_flair_type"] == "text") {
				if (item["link_flair_text"]?.length > 0) {
					const linkFlairText = item["link_flair_text"];
					const linkFlairParameter = encodeURIComponent(`flair_name:"${linkFlairText}"`);
					const flairAnnotation = Annotation.createWithText(linkFlairText);
					flairAnnotation.uri = `https://www.reddit.com/r/${subredditName}/?f=${linkFlairParameter}`;
					annotations.push(flairAnnotation);
				}
			}
			else if (item["link_flair_type"] == "richtext") {
				if (item["link_flair_text"]?.length > 0) {
					const linkFlairText = item["link_flair_text"];
					const linkFlairParameter = encodeURIComponent(`flair_name:"${linkFlairText}"`);
					const flairAnnotation = Annotation.createWithText(linkFlairText);
					flairAnnotation.uri = `https://www.reddit.com/r/${subredditName}/?f=${linkFlairParameter}`;
					annotations.push(flairAnnotation);

					const itemLinkFlairRichText = item["link_flair_richtext"];
					if (itemLinkFlairRichText instanceof Array) {
						shortcodes = {};
						for (const linkFlairRichText of itemLinkFlairRichText) {
							if (linkFlairRichText?.e == "emoji") {
								let name = linkFlairRichText?.a.slice(1, -1);
								if (name?.length > 0) {
									let url = linkFlairRichText?.u;
									if (url?.length > 0) {
										shortcodes[name] = url;
									}
								}
							}
						}
					}
				}
			}
		}
	}

	const resultItem = Item.createWithUriDate(uri, date);
	resultItem.title = title;
	resultItem.body = content;
	resultItem.author = identity;
	if (attachments != null) {
		resultItem.attachments = attachments;
	}
	if (annotations.length > 0) {
		resultItem.annotations = annotations;
	}
	if (shortcodes != null) {
		resultItem.shortcodes = shortcodes;
	}

	return resultItem;
}
