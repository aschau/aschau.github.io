$(document).ready(function (){
	$("#eject").click(function (){
		$('html, body').animate({
			scrollTop: $("#top_menu").offset().top
		}, 2000);
	});
});