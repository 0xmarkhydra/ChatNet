package languagecatalog

import "strings"

const supportedCodes = `
aa ab ae af ak am an ar as av ay az
ba be bg bh bi bm bn bo br bs
ca ce ch co cr cs cu cv cy
da de dv dz
ee el en eo es et eu
fa ff fi fj fo fr fy
ga gd gl gn gu gv
ha he hi ho hr ht hu hy hz
ia id ie ig ii ik io is it iu
ja jv
ka kg ki kj kk kl km kn ko kr ks ku kv kw ky
la lb lg li ln lo lt lu lv
mg mh mi mk ml mn mr ms mt my
na nb nd ne ng nl nn no nr nv ny
oc oj om or os
pa pi pl ps pt
qu
rm rn ro ru rw
sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw
ta te tg th ti tk tl tn to tr ts tt tw ty
ug uk ur uz
ve vi vo
wa wo
xh yi yo
za zh zu
`

var supported = func() map[string]struct{} {
	result := make(map[string]struct{}, 190)
	for _, code := range strings.Fields(supportedCodes) {
		result[code] = struct{}{}
	}
	return result
}()

func Normalize(code string) string {
	return strings.ToLower(strings.TrimSpace(code))
}

func Valid(code string) bool {
	_, ok := supported[Normalize(code)]
	return ok
}

func PromptName(code string) string {
	code = Normalize(code)
	switch code {
	case "vi":
		return "Vietnamese"
	case "en":
		return "English"
	case "ja":
		return "Japanese"
	case "ko":
		return "Korean"
	case "zh":
		return "Chinese"
	case "th":
		return "Thai"
	case "fr":
		return "French"
	case "de":
		return "German"
	case "es":
		return "Spanish"
	case "pt":
		return "Portuguese"
	case "ru":
		return "Russian"
	case "ar":
		return "Arabic"
	case "hi":
		return "Hindi"
	case "id":
		return "Indonesian"
	case "ms":
		return "Malay"
	default:
		return "the language identified by ISO 639-1 code " + code
	}
}
