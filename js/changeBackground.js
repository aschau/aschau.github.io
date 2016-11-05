function changeBackground(elem)
{
	var thisElement = elem;
	var body = document.getElementsByTagName("body")[0]
	if (thisElement.value != "default")
	{
		body.style.background = "url('img/GameBackground2.png') no-repeat fixed";
		thisElement.value = "default";
	}
	
	else{
		body.style.background = "url('img/GameBackground3.png') no-repeat fixed";
		thisElement.value = "alternate";
	}
	body.style.backgroundSize = "cover";
}