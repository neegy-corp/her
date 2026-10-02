"""Create a dedicated HER profile/collection without changing existing collections."""
import json, os, pathlib, uuid
root=pathlib.Path(__file__).resolve().parent
obs=pathlib.Path(os.environ['APPDATA'])/'obs-studio'
profile=obs/'basic/profiles/HER'
collection=obs/'basic/scenes/HER.json'
if profile.exists() or collection.exists():
    raise SystemExit('HER OBS configuration already exists; leaving it unchanged.')
profile.mkdir(parents=True)
(root/'qa').mkdir(exist_ok=True)
(profile/'basic.ini').write_text(f'''[General]
Name=HER
[Output]
Mode=Simple
[SimpleOutput]
VBitrate=4500
ABitrate=160
StreamEncoder=x264
RecEncoder=x264
RecQuality=Small
RecFormat2=mkv
FilePath={str(root/'qa').replace(chr(92),'/')}
[Video]
BaseCX=1920
BaseCY=1080
OutputCX=1920
OutputCY=1080
FPSType=0
FPSCommon=30
[Audio]
SampleRate=48000
ChannelSetup=Stereo
''',encoding='utf-8')
def source(name,kind,settings):
 return {'name':name,'uuid':str(uuid.uuid4()),'id':kind,'versioned_id':kind,'settings':settings,'mixers':1,'sync':0,'flags':0,'volume':1.0,'balance':0.5,'enabled':True,'muted':False,'hotkeys':{},'monitoring_type':0,'private_settings':{}}
image=source('HER standby portrait','image_source',{'file':str(root.parent/'her/public/olivia-standby.jpg').replace('\\','/')})
label=source('HER standby disclosure','text_gdiplus',{'text':'HER  /  AI HOST\nSTANDBY — LIVE VIDEO NOT CONNECTED','font':{'face':'Arial','size':40,'style':'Bold','flags':1},'color':16777215,'outline':True,'outline_size':3,'outline_color':0})
def item(s,i,pos,scale):
 return {'name':s['name'],'source_uuid':s['uuid'],'id':i,'visible':True,'locked':True,'rot':0.0,'align':5,'pos':pos,'scale':scale,'bounds_type':0,'bounds':{'x':0.0,'y':0.0},'crop_left':0,'crop_right':0,'crop_top':0,'crop_bottom':0}
scene=source('HER — standby','scene',{'id_counter':2,'custom_size':False,'items':[item(image,1,{'x':0.0,'y':0.0},{'x':0.5,'y':0.5}),item(label,2,{'x':80.0,'y':900.0},{'x':1.0,'y':1.0})]})
data={'name':'HER','current_scene':scene['name'],'current_program_scene':scene['name'],'scene_order':[{'name':scene['name']}],'sources':[image,label,scene],'groups':[],'transitions':[],'current_transition':'Fade','transition_duration':300}
collection.write_text(json.dumps(data,indent=2),encoding='utf-8')
print('Created HER OBS profile and clearly labeled standby scene at 1080p30. Existing OBS collections preserved. No live capture or stream destination configured.')
